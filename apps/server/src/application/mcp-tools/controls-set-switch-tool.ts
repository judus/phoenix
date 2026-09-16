import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { StatefulGameActionService } from '../stateful-game-action-service.js'
import type { Commands } from '../../domain/commands.js'
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
    name: 'controls.set_control_state'
  }

  public constructor (
    private readonly statefulActions: StatefulGameActionService,
    private readonly commands: Commands
  ) {}

  public readonly execute = async (arguments_: JsonObject, context: Parameters<LocalTool['execute']>[1]) => {
    const actionId = stringArgument(arguments_, 'actionId')
    const enabled = this.commands.getCatalog().commands.some(command => (
      command.kind === 'game-action' && command.target.type === 'game-action' && command.target.actionId === actionId
    ))
    if (!enabled) {
      return output('This Copilot capability is disabled in Settings.', json({ actionId, status: 'rejected' }))
    }
    const result = await this.statefulActions.setSwitch({ actionId, enabled: booleanArgument(arguments_, 'enabled') }, context.signal)
    return output(result.message, json(result))
  }
}
