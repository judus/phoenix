import type {
  ControlDeckAdapterDescriptor,
  ControlDeckAdapterExecutionResult,
  ControlDeckCommandAdapter,
  ControlDeckCommandInvocation,
  ControlDeckCommandTarget
} from '@jdu/control-deck-core'
import type { CommandDescriptor, GameActionCatalogResponse } from '@phoenix/contracts'
import type { Commands } from '../domain/commands.js'
import type { GameActions } from './game-action-service.js'

export class PhoenixControlDeckCommandAdapter implements ControlDeckCommandAdapter {
  public constructor (
    private readonly commands: Commands,
    private readonly gameActions: GameActions
  ) {}

  public describe (): ControlDeckAdapterDescriptor {
    const actions = this.gameActions.getCatalog()
    return {
      id: 'phoenix.commands',
      version: '1',
      label: 'PHOENIX',
      available: true,
      simulated: false,
      detail: 'PHOENIX command services are available.',
      platformRequirements: [],
      holdOwner: 'adapter',
      commands: this.commands.getCatalog().commands.map(command => ({
        id: command.id,
        label: command.label,
        description: command.description ?? command.label,
        category: command.category,
        available: command.available,
        unavailableReason: command.unavailableReason ?? null,
        risk: command.risk,
        simulated: commandIsSimulated(command, actions),
        operations: commandOperations(command, actions),
        configurationSchema: { type: 'object', maxProperties: 0 }
      }))
    }
  }

  public validate (target: ControlDeckCommandTarget): string | null {
    if (target.adapterId !== 'phoenix.commands') return 'Unsupported PHOENIX command adapter.'
    if (Object.keys(target.configuration).length > 0) return 'PHOENIX commands do not accept target configuration.'
    return this.find(target.commandId) ? null : `Unknown PHOENIX command: ${target.commandId}.`
  }

  public async execute (
    invocation: ControlDeckCommandInvocation,
    signal: AbortSignal
  ): Promise<ControlDeckAdapterExecutionResult> {
    const descriptor = this.find(invocation.target.commandId)
    if (!descriptor) {
      return { status: 'rejected', message: `Unknown PHOENIX command: ${invocation.target.commandId}.` }
    }
    const result = await this.commands.execute({
      target: descriptor.target,
      operation: invocation.operation,
      requestId: invocation.requestId,
      correlationId: invocation.correlationId,
      ...(invocation.leaseId ? { leaseId: invocation.leaseId } : {}),
      ...(invocation.idempotencyKey ? { idempotencyKey: invocation.idempotencyKey } : {}),
      ...(invocation.timeoutMs ? { timeoutMs: invocation.timeoutMs } : {})
    }, 'ui', signal)
    return {
      status: result.status,
      message: result.message,
      simulated: commandIsSimulated(descriptor, this.gameActions.getCatalog()),
      data: {
        commandId: result.commandId,
        navigationHref: result.navigationHref,
        gameActionResult: result.gameActionResult
      }
    }
  }

  private find (commandId: string): CommandDescriptor | undefined {
    return this.commands.getCatalog().commands.find(command => command.id === commandId)
  }
}

function commandOperations (
  command: CommandDescriptor,
  actions: GameActionCatalogResponse
): Array<'tap' | 'press' | 'release'> {
  if (command.target.type !== 'game-action') return ['tap']
  const actionId = command.target.actionId
  const action = actions.actions.find(candidate => candidate.definition.id === actionId)
  return action?.definition.inputMode === 'hold' ? ['press', 'release'] : ['tap']
}

function commandIsSimulated (command: CommandDescriptor, actions: GameActionCatalogResponse): boolean {
  if (command.target.type === 'navigation') return false
  return actions.backend.simulated
}
