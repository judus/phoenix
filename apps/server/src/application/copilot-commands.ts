import { randomUUID } from 'node:crypto'
import {
  CommandExecutionResultSchema,
  ExecuteCommandRequestSchema,
  commandTargetKey,
  type CommandExecutionResult,
  type GameActionOrigin
} from '@phoenix/contracts'
import type { Commands } from '../domain/commands.js'
import type { CopilotCapabilities } from '../domain/copilot-capabilities.js'

export class CopilotCommands implements Commands {
  public constructor (
    private readonly commands: Commands,
    private readonly capabilities: CopilotCapabilities
  ) {}

  public getCatalog () {
    return {
      commands: this.commands.getCatalog().commands.filter(command => this.capabilities.isDescriptorEnabled(command))
    }
  }

  public execute (candidate: unknown, origin: GameActionOrigin, signal?: AbortSignal): Promise<CommandExecutionResult> {
    const request = ExecuteCommandRequestSchema.parse(candidate)
    if (this.capabilities.isCommandEnabled(request.target)) {
      return this.commands.execute(request, origin, signal)
    }
    const requestId = request.requestId ?? randomUUID()
    const descriptor = this.commands.getCatalog().commands.find(command => (
      commandTargetKey(command.target) === commandTargetKey(request.target)
    ))
    return Promise.resolve(CommandExecutionResultSchema.parse({
      requestId,
      correlationId: request.correlationId ?? requestId,
      commandId: descriptor?.id ?? 'unknown',
      target: request.target,
      operation: request.operation,
      origin,
      status: 'rejected',
      timestamp: new Date().toISOString(),
      message: 'This Copilot capability is disabled in Settings.',
      navigationHref: null,
      gameActionResult: null
    }))
  }
}
