import { randomUUID } from 'node:crypto'
import {
  CommandExecutionResultSchema,
  ExecuteCommandRequestSchema,
  GameActionOriginSchema,
  gameActionCommandId,
  macroCommandId,
  navigationCommandId,
  type CommandEffect,
  type CommandExecutionResult,
  type CommandOperation,
  type CopilotExecutionPermissions,
  type GameActionOrigin
} from '@phoenix/contracts'
import type { GameActions } from './game-action-service.js'
import type {
  CommandRegistry,
  Commands,
  NavigationCommandDestination,
  NavigationCommandExecutor
} from '../domain/commands.js'
import type { MacroCommandExecutor } from '../domain/macros.js'

export class DefaultCommandDispatcher implements Commands {
  public constructor (
    private readonly registry: CommandRegistry,
    private readonly gameActions: GameActions,
    private readonly destinations: readonly NavigationCommandDestination[],
    private readonly navigation: NavigationCommandExecutor = new BrowserNavigationCommandExecutor(),
    private readonly macros?: MacroCommandExecutor,
    private readonly copilotPermissions: () => CopilotExecutionPermissions = () => ({
      gameActions: true,
      macros: true,
      dangerousActions: true
    })
  ) {}

  public getCatalog () { return this.registry.getCatalog() }

  public async execute (
    candidate: unknown,
    originCandidate: GameActionOrigin,
    signal?: AbortSignal
  ): Promise<CommandExecutionResult> {
    const request = ExecuteCommandRequestSchema.parse(candidate)
    const origin = GameActionOriginSchema.parse(originCandidate)
    const requestId = request.requestId ?? randomUUID()
    const correlationId = request.correlationId ?? requestId
    const descriptor = this.registry.find(request.commandId)
    if (!descriptor) {
      return this.result(requestId, correlationId, request.commandId, request.operation, origin, 'rejected', 'Unknown command id.')
    }
    if (!descriptor.available) {
      return this.result(requestId, correlationId, descriptor.id, request.operation, origin, 'rejected', descriptor.unavailableReason ?? 'Command unavailable.')
    }
    if (!descriptor.supportedOperations.includes(request.operation)) {
      return this.result(requestId, correlationId, descriptor.id, request.operation, origin, 'rejected', `${descriptor.label} does not support ${request.operation}.`)
    }
    if (origin === 'copilot') {
      const permissions = this.copilotPermissions()
      if (descriptor.kind === 'game-action' && !permissions.gameActions) {
        return this.result(requestId, correlationId, descriptor.id, request.operation, origin, 'rejected', 'Copilot game actions are disabled in Settings.')
      }
      if (descriptor.kind === 'macro' && !permissions.macros) {
        return this.result(requestId, correlationId, descriptor.id, request.operation, origin, 'rejected', 'Copilot macros are disabled in Settings.')
      }
      if (['game-action', 'macro'].includes(descriptor.kind) && ['dangerous', 'destructive'].includes(descriptor.risk) && !permissions.dangerousActions) {
        return this.result(requestId, correlationId, descriptor.id, request.operation, origin, 'rejected', 'Dangerous Copilot actions are disabled in Settings.')
      }
    }
    if (descriptor.kind === 'macro') {
      if (!this.macros) {
        return this.result(requestId, correlationId, descriptor.id, request.operation, origin, 'rejected', 'Macro commands are not enabled.')
      }
      const macroId = idSuffix(descriptor.id, macroCommandId(''))
      const playback = await this.macros.execute(macroId, origin, signal)
      const status = playback.status === 'completed'
        ? 'accepted'
        : playback.status === 'aborted' ? 'cancelled' : playback.status === 'timed_out' ? 'timed_out' : 'failed'
      return this.result(requestId, correlationId, descriptor.id, request.operation, origin, status, playback.message, [{ type: 'macro-playback', payload: { playback } }])
    }
    if (descriptor.kind === 'navigation') {
      const destinationId = idSuffix(descriptor.id, navigationCommandId(''))
      const destination = this.destinations.find(entry => entry.id === destinationId)
      if (!destination) {
        return this.result(requestId, correlationId, descriptor.id, request.operation, origin, 'rejected', 'Navigation destination unavailable.')
      }
      const navigation = await this.navigation.execute(destination, request.operation)
      return this.result(requestId, correlationId, descriptor.id, request.operation, origin, 'accepted', navigation.message, [{ type: 'navigate', payload: { href: navigation.href } }])
    }
    if (descriptor.kind !== 'game-action') {
      return this.result(requestId, correlationId, descriptor.id, request.operation, origin, 'rejected', `Phoenix cannot execute command kind ${descriptor.kind}.`)
    }

    const actionId = idSuffix(descriptor.id, gameActionCommandId(''))
    const gameActionResult = await this.gameActions.execute({
      actionId,
      operation: request.operation,
      requestId,
      correlationId,
      ...(request.leaseId ? { leaseId: request.leaseId } : {}),
      ...(request.idempotencyKey ? { idempotencyKey: request.idempotencyKey } : {}),
      ...(request.timeoutMs ? { timeoutMs: request.timeoutMs } : {})
    }, origin, signal)
    return this.result(
      requestId,
      correlationId,
      descriptor.id,
      request.operation,
      origin,
      gameActionResult.status,
      gameActionResult.message,
      [{ type: 'game-action', payload: { result: gameActionResult } }],
      gameActionResult.timestamp
    )
  }

  private result (
    requestId: string,
    correlationId: string,
    commandId: string,
    operation: CommandOperation,
    origin: GameActionOrigin,
    status: CommandExecutionResult['status'],
    message: string,
    effects: CommandEffect[] = [],
    timestamp: string = new Date().toISOString()
  ): CommandExecutionResult {
    return CommandExecutionResultSchema.parse({
      requestId,
      correlationId,
      commandId,
      operation,
      origin,
      status,
      timestamp,
      message,
      effects
    })
  }
}

export class BrowserNavigationCommandExecutor implements NavigationCommandExecutor {
  public async execute (destination: NavigationCommandDestination): Promise<{ href: string, message: string }> {
    return { href: destination.href, message: `Open ${destination.label}.` }
  }
}

function idSuffix (commandId: string, prefix: string): string {
  if (!commandId.startsWith(prefix) || commandId.length === prefix.length) throw new Error(`Invalid Phoenix command id: ${commandId}.`)
  return commandId.slice(prefix.length)
}
