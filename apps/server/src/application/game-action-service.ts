import { randomUUID } from 'node:crypto'
import {
  CommandExecutionRuntime,
  type CommandExecutionAdapter,
  type CommandRuntimeRequest
} from 'control-deck/core'
import {
  ExecuteGameActionRequestSchema,
  GameActionCatalogResponseSchema,
  GameActionCommandSchema,
  GameActionOriginSchema,
  GameActionResultSchema,
  type GameActionCatalogResponse,
  type GameActionCommand,
  type GameActionOrigin,
  type GameActionResult
} from '@phoenix/contracts'
import type { GameActionGateway } from '../domain/game-actions.js'

export interface GameActions {
  execute(candidate: unknown, origin: GameActionOrigin, signal?: AbortSignal): Promise<GameActionResult>
  getCatalog(): GameActionCatalogResponse
  stop?(): Promise<void>
}

export class GameActionService implements GameActions {
  private readonly runtime: CommandExecutionRuntime<GameActionCommand, GameActionResult>

  public constructor (
    private readonly gateway: GameActionGateway,
    maximumHoldMs = 15_000
  ) {
    this.runtime = new CommandExecutionRuntime(new PhoenixGameActionAdapter(gateway), maximumHoldMs)
  }

  public getCatalog (): GameActionCatalogResponse {
    return GameActionCatalogResponseSchema.parse(this.gateway.getCatalog())
  }

  public execute (candidate: unknown, originCandidate: GameActionOrigin, signal?: AbortSignal): Promise<GameActionResult> {
    const request = ExecuteGameActionRequestSchema.parse(candidate)
    const origin = GameActionOriginSchema.parse(originCandidate)
    const requestId = request.requestId ?? randomUUID()
    const command = GameActionCommandSchema.parse({
      ...request,
      requestId,
      correlationId: request.correlationId ?? requestId,
      origin
    })
    return this.runtime.execute({
      correlationId: command.correlationId!,
      ...(command.idempotencyKey ? { idempotencyKey: command.idempotencyKey } : {}),
      ...(command.leaseId ? { leaseId: command.leaseId } : {}),
      operation: command.operation,
      ownerKey: command.origin,
      payload: command,
      requestId: command.requestId!,
      targetKey: command.actionId,
      ...(command.timeoutMs ? { timeoutMs: command.timeoutMs } : {})
    }, signal)
  }

  public stop (): Promise<void> {
    return this.runtime.stop()
  }
}

class PhoenixGameActionAdapter implements CommandExecutionAdapter<GameActionCommand, GameActionResult> {
  public constructor (private readonly gateway: GameActionGateway) {}

  public createExpiredRelease (
    request: CommandRuntimeRequest<GameActionCommand>
  ): CommandRuntimeRequest<GameActionCommand> {
    const requestId = randomUUID()
    const payload = GameActionCommandSchema.parse({
      ...request.payload,
      correlationId: requestId,
      operation: 'release',
      requestId
    })
    return {
      ...request,
      correlationId: requestId,
      operation: 'release',
      payload,
      requestId
    }
  }

  public createResult (
    request: CommandRuntimeRequest<GameActionCommand>,
    status: 'accepted' | 'rejected',
    message: string
  ): GameActionResult {
    return GameActionResultSchema.parse({
      ...request.payload,
      status,
      timestamp: new Date().toISOString(),
      message
    })
  }

  public async execute (
    request: CommandRuntimeRequest<GameActionCommand>,
    signal: AbortSignal
  ): Promise<GameActionResult> {
    return GameActionResultSchema.parse(await this.gateway.execute(request.payload, signal))
  }
}
