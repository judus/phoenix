import { randomUUID } from 'node:crypto'
import {
  CommandExecutionResultSchema,
  ExecuteCommandRequestSchema,
  GameActionOriginSchema,
  type CommandExecutionResult,
  type CommandTarget,
  type CopilotExecutionPermissions,
  type GameActionOperation,
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
    const descriptor = this.registry.find(request.target)
    if (!descriptor) {
      return this.result(requestId, correlationId, 'unknown', request.target, request.operation, origin, 'rejected', 'Unknown command target.')
    }
    if (!descriptor.available) {
      return this.result(requestId, correlationId, descriptor.id, request.target, request.operation, origin, 'rejected', descriptor.unavailableReason ?? 'Command unavailable.')
    }
    if (origin === 'copilot') {
      const permissions = this.copilotPermissions()
      if (request.target.type === 'game-action' && !permissions.gameActions) {
        return this.result(requestId, correlationId, descriptor.id, request.target, request.operation, origin, 'rejected', 'Copilot game actions are disabled in Settings.')
      }
      if (request.target.type === 'macro' && !permissions.macros) {
        return this.result(requestId, correlationId, descriptor.id, request.target, request.operation, origin, 'rejected', 'Copilot macros are disabled in Settings.')
      }
      if ((request.target.type === 'game-action' || request.target.type === 'macro') && ['dangerous', 'destructive'].includes(descriptor.risk) && !permissions.dangerousActions) {
        return this.result(requestId, correlationId, descriptor.id, request.target, request.operation, origin, 'rejected', 'Dangerous Copilot actions are disabled in Settings.')
      }
    }
    if (request.target.type === 'macro') {
      if (!this.macros) {
        return this.result(requestId, correlationId, descriptor.id, request.target, request.operation, origin, 'rejected', 'Macro commands are not enabled.')
      }
      if (request.operation !== 'tap') {
        return this.result(requestId, correlationId, descriptor.id, request.target, request.operation, origin, 'rejected', 'Macro commands only support tap execution.')
      }
      const playback = await this.macros.execute(request.target.macroId, origin, signal)
      const status = playback.status === 'completed'
        ? 'accepted'
        : playback.status === 'aborted' ? 'cancelled' : playback.status === 'timed_out' ? 'timed_out' : 'failed'
      return this.result(requestId, correlationId, descriptor.id, request.target, request.operation, origin, status, playback.message)
    }
    if (request.target.type === 'navigation') {
      const destinationId = request.target.destinationId
      const destination = this.destinations.find(entry => entry.id === destinationId)
      if (!destination) {
        return this.result(requestId, correlationId, descriptor.id, request.target, request.operation, origin, 'rejected', 'Navigation destination unavailable.')
      }
      if (request.operation !== 'tap') {
        return this.result(requestId, correlationId, descriptor.id, request.target, request.operation, origin, 'rejected', 'Navigation commands only support tap execution.')
      }
      const navigation = await this.navigation.execute(destination, request.operation)
      return this.result(requestId, correlationId, descriptor.id, request.target, request.operation, origin, 'accepted', navigation.message, navigation.href)
    }

    const gameActionResult = await this.gameActions.execute({
      actionId: request.target.actionId,
      operation: request.operation,
      requestId,
      correlationId,
      ...(request.idempotencyKey ? { idempotencyKey: request.idempotencyKey } : {}),
      ...(request.timeoutMs ? { timeoutMs: request.timeoutMs } : {})
    }, origin, signal)
    return CommandExecutionResultSchema.parse({
      requestId,
      correlationId,
      commandId: descriptor.id,
      target: request.target,
      operation: request.operation,
      origin,
      status: gameActionResult.status,
      timestamp: gameActionResult.timestamp,
      message: gameActionResult.message,
      navigationHref: null,
      gameActionResult
    })
  }

  private result (
    requestId: string,
    correlationId: string,
    commandId: string,
    target: CommandTarget,
    operation: GameActionOperation,
    origin: GameActionOrigin,
    status: CommandExecutionResult['status'],
    message: string,
    navigationHref: string | null = null
  ): CommandExecutionResult {
    return CommandExecutionResultSchema.parse({
      requestId,
      correlationId,
      commandId,
      target,
      operation,
      origin,
      status,
      timestamp: new Date().toISOString(),
      message,
      navigationHref,
      gameActionResult: null
    })
  }
}

export class BrowserNavigationCommandExecutor implements NavigationCommandExecutor {
  public async execute (destination: NavigationCommandDestination): Promise<{ href: string, message: string }> {
    return { href: destination.href, message: `Open ${destination.label}.` }
  }
}
