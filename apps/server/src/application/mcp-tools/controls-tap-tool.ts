import type { JsonObject, LocalTool } from '@maduser/ai-ts'
import type { GameActions } from '../game-action-service.js'
import { json, output, stringArgument } from './tool-support.js'

export class ControlsTapTool implements LocalTool {
  public readonly definition = {
    annotations: { destructive: false, idempotent: false, openWorld: false },
    description: 'Tap one configured Elite Dangerous action by exact PHOENIX action ID. Use only for a clear commander request; use controls.find_actions first when the ID is unknown.',
    inputSchema: { additionalProperties: false, properties: { actionId: { minLength: 1, type: 'string' } }, required: ['actionId'], type: 'object' },
    name: 'controls.tap'
  }

  public constructor (private readonly gameActions: GameActions) {}

  public readonly execute = async (arguments_: JsonObject) => {
    const result = await this.gameActions.execute({ actionId: stringArgument(arguments_, 'actionId'), operation: 'tap' }, 'copilot')
    return output(result.message, json(result))
  }
}
