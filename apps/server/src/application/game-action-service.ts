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
}

export class GameActionService implements GameActions {
  private readonly idempotentRequests = new Map<string, { fingerprint: string, result: Promise<GameActionResult> }>()

  public constructor (private readonly gateway: GameActionGateway) {}

  public getCatalog (): GameActionCatalogResponse {
    return GameActionCatalogResponseSchema.parse(this.gateway.getCatalog())
  }

  public async execute (candidate: unknown, originCandidate: GameActionOrigin, callerSignal?: AbortSignal): Promise<GameActionResult> {
    const request = ExecuteGameActionRequestSchema.parse(candidate)
    const origin = GameActionOriginSchema.parse(originCandidate)
    const requestId = request.requestId ?? randomUUID()
    const command = { ...request, requestId, correlationId: request.correlationId ?? requestId, origin }
    const fingerprint = `${origin}:${request.actionId}:${request.operation}`
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

    const execution = this.executeCommand(command, callerSignal)
    if (cacheKey !== undefined) {
      this.idempotentRequests.set(cacheKey, { fingerprint, result: execution })
      if (this.idempotentRequests.size > 1_000) {
        this.idempotentRequests.delete(this.idempotentRequests.keys().next().value as string)
      }
    }
    return execution
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
