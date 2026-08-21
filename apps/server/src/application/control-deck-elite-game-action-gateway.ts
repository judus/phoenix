import {
  ControlDeckCommandService,
  type ControlDeckCommandExecutionResult
} from '@jdu/control-deck-core'
import {
  ELITE_DANGEROUS_ADAPTER_ID,
  type EliteDangerousCommandAdapter
} from '@jdu/control-deck-integration-elite-dangerous'
import {
  GameActionCatalogResponseSchema,
  GameActionCommandSchema,
  GameActionResultSchema,
  type GameActionCatalogResponse,
  type GameActionCommand,
  type GameActionResult
} from '@phoenix/contracts'
import type { GameActionGateway } from '../domain/game-actions.js'

export class ControlDeckEliteGameActionGateway implements GameActionGateway {
  public constructor (
    private readonly adapter: EliteDangerousCommandAdapter,
    private readonly commands: ControlDeckCommandService
  ) {}

  public getCatalog (): GameActionCatalogResponse {
    const snapshot = this.adapter.getSnapshot()
    return GameActionCatalogResponseSchema.parse({
      backend: {
        id: snapshot.backend.id,
        available: snapshot.backend.available,
        simulated: snapshot.backend.simulated,
        detail: snapshot.backend.detail
      },
      bindingSource: snapshot.bindingSource,
      actions: snapshot.actions
    })
  }

  public async execute (candidate: GameActionCommand, signal?: AbortSignal): Promise<GameActionResult> {
    const command = GameActionCommandSchema.parse(candidate)
    const result = await this.commands.execute({
      target: {
        adapterId: ELITE_DANGEROUS_ADAPTER_ID,
        commandId: command.actionId,
        configuration: {}
      },
      operation: command.operation,
      ...(command.leaseId ? { leaseId: command.leaseId } : {}),
      ...(command.requestId ? { requestId: command.requestId } : {}),
      ...(command.correlationId ? { correlationId: command.correlationId } : {}),
      ...(command.idempotencyKey ? { idempotencyKey: command.idempotencyKey } : {}),
      ...(command.timeoutMs ? { timeoutMs: command.timeoutMs } : {})
    }, `phoenix:${command.origin}`, signal)
    return mapResult(command, result)
  }
}

function mapResult (command: GameActionCommand, result: ControlDeckCommandExecutionResult): GameActionResult {
  return GameActionResultSchema.parse({
    requestId: result.requestId,
    correlationId: result.correlationId,
    actionId: command.actionId,
    operation: result.operation,
    origin: command.origin,
    status: result.status,
    timestamp: result.timestamp,
    message: result.message
  })
}
