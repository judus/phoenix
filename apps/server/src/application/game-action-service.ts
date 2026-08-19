import {
  ExecuteGameActionRequestSchema,
  GameActionCatalogResponseSchema,
  GameActionOriginSchema,
  GameActionResultSchema,
  type GameActionCatalogResponse,
  type GameActionOrigin,
  type GameActionResult
} from '@phoenix/contracts'
import { randomUUID } from 'node:crypto'
import type { GameActionGateway } from '../domain/game-actions.js'

export interface GameActions {
  execute(candidate: unknown, origin: GameActionOrigin, signal?: AbortSignal): Promise<GameActionResult>
  getCatalog(): GameActionCatalogResponse
  stop?(): Promise<void>
}

export class GameActionService implements GameActions {
  private readonly idempotentRequests = new Map<string, { fingerprint: string, result: Promise<GameActionResult> }>()
  private readonly holdLeases = new Map<string, { actionId: string, origin: GameActionOrigin, timer: NodeJS.Timeout }>()
  private readonly leaseQueues = new Map<string, Promise<unknown>>()

  public constructor (
    private readonly gateway: GameActionGateway,
    private readonly maximumHoldMs = 15_000
  ) {}

  public getCatalog (): GameActionCatalogResponse {
    return GameActionCatalogResponseSchema.parse(this.gateway.getCatalog())
  }

  public async execute (candidate: unknown, originCandidate: GameActionOrigin, callerSignal?: AbortSignal): Promise<GameActionResult> {
    const request = ExecuteGameActionRequestSchema.parse(candidate)
    const origin = GameActionOriginSchema.parse(originCandidate)
    const requestId = request.requestId ?? randomUUID()
    const command = { ...request, requestId, correlationId: request.correlationId ?? requestId, origin }
    if (request.operation !== 'tap' && !request.leaseId) {
      return this.rejected(command, 'Hold actions require a lease ID.')
    }
    const fingerprint = `${origin}:${request.actionId}:${request.operation}:${request.leaseId ?? ''}`
    const cacheKey = request.idempotencyKey === undefined ? undefined : `${origin}:${request.idempotencyKey}`
    const cached = cacheKey === undefined ? undefined : this.idempotentRequests.get(cacheKey)
    if (cached) {
      if (cached.fingerprint !== fingerprint) {
        return GameActionResultSchema.parse({
          ...command,
          status: 'rejected',
          timestamp: new Date().toISOString(),
          message: 'The idempotency key was already used for a different action.'
        })
      }
      return cached.result
    }

    const execution = command.leaseId && command.operation !== 'tap'
      ? this.enqueueLeaseTransition(command, callerSignal)
      : this.executeCommand(command, callerSignal)
    if (cacheKey !== undefined) {
      this.idempotentRequests.set(cacheKey, { fingerprint, result: execution })
      if (this.idempotentRequests.size > 1_000) {
        this.idempotentRequests.delete(this.idempotentRequests.keys().next().value as string)
      }
    }
    return execution
  }

  public async stop (): Promise<void> {
    await Promise.all([...this.holdLeases.keys()].map(leaseId => this.expireLease(leaseId)))
  }

  private enqueueLeaseTransition (
    command: Parameters<GameActionGateway['execute']>[0],
    callerSignal?: AbortSignal
  ): Promise<GameActionResult> {
    const leaseId = command.leaseId!
    const previous = this.leaseQueues.get(leaseId) ?? Promise.resolve()
    const execution = previous
      .catch(() => undefined)
      .then(() => this.executeLeaseTransition(command, callerSignal))
    this.leaseQueues.set(leaseId, execution)
    const cleanQueue = () => {
      if (this.leaseQueues.get(leaseId) === execution) this.leaseQueues.delete(leaseId)
    }
    void execution.then(cleanQueue, cleanQueue)
    return execution
  }

  private async executeLeaseTransition (
    command: Parameters<GameActionGateway['execute']>[0],
    callerSignal?: AbortSignal
  ): Promise<GameActionResult> {
    const leaseId = command.leaseId!
    const lease = this.holdLeases.get(leaseId)
    if (command.operation === 'press' && lease) {
      return this.rejected(command, 'This hold lease is already active.')
    }
    if (command.operation === 'release') {
      if (!lease) return this.rejected(command, 'This hold lease is not active.')
      if (lease.actionId !== command.actionId || lease.origin !== command.origin) {
        return this.rejected(command, 'This hold lease belongs to a different action or origin.')
      }
    }

    const result = await this.executeCommand(command, callerSignal)
    if (result.status !== 'accepted') return result
    if (command.operation === 'press') {
      this.holdLeases.set(leaseId, {
        actionId: command.actionId,
        origin: command.origin,
        timer: this.scheduleExpiry(leaseId, this.maximumHoldMs)
      })
    } else {
      clearTimeout(lease!.timer)
      this.holdLeases.delete(leaseId)
    }
    return result
  }

  private scheduleExpiry (leaseId: string, delayMs: number): NodeJS.Timeout {
    const timer = setTimeout(() => {
      void this.expireLease(leaseId).catch(() => {
        const lease = this.holdLeases.get(leaseId)
        if (lease) this.holdLeases.set(leaseId, { ...lease, timer: this.scheduleExpiry(leaseId, 1_000) })
      })
    }, delayMs)
    timer.unref()
    return timer
  }

  private async expireLease (leaseId: string): Promise<void> {
    const lease = this.holdLeases.get(leaseId)
    if (!lease) return
    const requestId = randomUUID()
    const result = await this.enqueueLeaseTransition({
      actionId: lease.actionId,
      correlationId: requestId,
      leaseId,
      operation: 'release',
      origin: lease.origin,
      requestId
    })
    if (result.status !== 'accepted' && this.holdLeases.has(leaseId)) {
      clearTimeout(lease.timer)
      this.holdLeases.set(leaseId, { ...lease, timer: this.scheduleExpiry(leaseId, 1_000) })
    }
  }

  private rejected (
    command: Parameters<GameActionGateway['execute']>[0],
    message: string
  ): GameActionResult {
    return GameActionResultSchema.parse({
      ...command,
      status: 'rejected',
      timestamp: new Date().toISOString(),
      message
    })
  }

  private async executeCommand (
    command: Parameters<GameActionGateway['execute']>[0],
    callerSignal?: AbortSignal
  ): Promise<GameActionResult> {
    const timeout = AbortSignal.timeout(command.timeoutMs ?? 5_000)
    const signal = callerSignal === undefined ? timeout : AbortSignal.any([callerSignal, timeout])
    return GameActionResultSchema.parse(await this.gateway.execute(command, signal))
  }
}
