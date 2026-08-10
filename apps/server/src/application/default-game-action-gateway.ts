import { randomUUID } from 'node:crypto'
import {
  GameActionCommandSchema,
  GameActionResultSchema,
  type GameActionCatalogResponse,
  type GameActionCommand,
  type GameActionResult
} from '@phoenix/contracts'
import {
  getActionAvailability,
  type GameActionBindingResolver,
  type GameActionCatalog,
  type GameActionGateway,
  type InputBackend
} from '../domain/game-actions.js'

export class DefaultGameActionGateway implements GameActionGateway {
  public constructor (
    private readonly catalog: GameActionCatalog,
    private readonly bindings: GameActionBindingResolver,
    private readonly backend: InputBackend
  ) {}

  public getCatalog (): GameActionCatalogResponse {
    const backend = this.backend.getStatus()
    return {
      backend,
      actions: this.catalog.list().map(definition => getActionAvailability(
        definition,
        this.bindings.resolve(definition.eliteBinding),
        backend
      ))
    }
  }

  public async execute (candidate: GameActionCommand): Promise<GameActionResult> {
    const command = GameActionCommandSchema.parse(candidate)
    const definition = this.catalog.find(command.actionId)
    if (!definition) return this.result(command, 'rejected', `Unknown action: ${command.actionId}.`)

    if (definition.inputMode === 'tap' && command.operation !== 'tap') {
      return this.result(command, 'rejected', `${definition.label} only supports tap input.`)
    }
    if (definition.inputMode === 'hold' && command.operation === 'tap') {
      return this.result(command, 'rejected', `${definition.label} requires press or release input.`)
    }

    const backend = this.backend.getStatus()
    if (!backend.available) return this.result(command, 'rejected', backend.detail)

    const binding = this.bindings.resolve(definition.eliteBinding)
    if (!binding) {
      return this.result(command, 'rejected', `No keyboard binding is configured for ${definition.label}.`)
    }

    try {
      await this.backend.send(command.operation, binding)
      const simulation = backend.simulated ? ' Simulation only; no operating-system input was sent.' : ''
      return this.result(command, 'accepted', `${definition.label} input accepted.${simulation}`)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unknown input backend failure.'
      return this.result(command, 'failed', `${definition.label} input failed: ${message}`)
    }
  }

  private result (
    command: GameActionCommand,
    status: GameActionResult['status'],
    message: string
  ): GameActionResult {
    return GameActionResultSchema.parse({
      requestId: randomUUID(),
      actionId: command.actionId,
      operation: command.operation,
      origin: command.origin,
      status,
      timestamp: new Date().toISOString(),
      message
    })
  }
}
