import type { JsonObject, LocalTool } from '@judus/llm-client'
import type { GameActions } from '../game-action-service.js'
import { json, optionalStringArgument, output, stringArgument } from './tool-support.js'

export class ControlsExecuteTool implements LocalTool {
  public readonly definition = {
    annotations: { destructive: true, idempotent: false, openWorld: false },
    description: 'Execute one PHOENIX game action through the shared action gateway. Use only for a clear commander request. Use controls.find_actions first when the exact action ID is unknown. The result reports accepted input, not invented telemetry confirmation.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        actionId: { minLength: 1, type: 'string' },
        operation: { default: 'tap', enum: ['tap', 'press', 'release'], type: 'string' }
      },
      required: ['actionId'],
      type: 'object'
    },
    name: 'controls.execute'
  }

  public constructor (private readonly gameActions: GameActions) {}

  public readonly execute = async (arguments_: JsonObject) => {
    const result = await this.gameActions.execute({ actionId: stringArgument(arguments_, 'actionId'), operation: optionalStringArgument(arguments_, 'operation') ?? 'tap' }, 'copilot')
    return output(result.message, json(result))
  }
}
