import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { StatefulGameActionService } from '../stateful-game-action-service.js'
import { booleanArgument, json, output, stringArgument } from './tool-support.js'

export class ControlsSetSwitchTool implements LocalTool {
  public readonly definition = {
    annotations: { destructive: false, idempotent: true, openWorld: false },
    description: 'Set an observable toggle action such as ship lights, night vision, cargo scoop, landing gear, or hardpoints to a requested on/off state. Checks fresh telemetry and distinguishes confirmed from unconfirmed input.',
    inputSchema: {
      additionalProperties: false,
      properties: { actionId: { minLength: 1, type: 'string' }, enabled: { type: 'boolean' } },
      required: ['actionId', 'enabled'],
      type: 'object'
    },
    name: 'controls.set_switch'
  }

  public constructor (private readonly statefulActions: StatefulGameActionService) {}

  public readonly execute = async (arguments_: JsonObject, context: Parameters<LocalTool['execute']>[1]) => {
    const result = await this.statefulActions.setSwitch({ actionId: stringArgument(arguments_, 'actionId'), enabled: booleanArgument(arguments_, 'enabled') }, context.signal)
    return output(result.message, json(result))
  }
}
