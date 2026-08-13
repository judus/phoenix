import type { JsonObject, LocalTool } from '@judus/llm-client'
import { CommandTargetSchema } from '@phoenix/contracts'
import type { Commands } from '../../domain/commands.js'
import { json, optionalStringArgument, output } from './tool-support.js'

export class ControlsExecuteTool implements LocalTool {
  public readonly definition: LocalTool['definition'] = {
    annotations: { destructive: true, idempotent: false, openWorld: false },
    description: 'Execute one PHOENIX control or commander-created macro through the shared typed command gateway. Pass the exact target returned by controls.find_actions. Use only when the commander clearly asks to operate, press, run, activate, or otherwise execute it. Questions about whether a control exists, is visible, or can be found are never execution authorization. Completion reports command dispatch, not an invented physical outcome.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        operation: { default: 'tap', enum: ['tap', 'press', 'release'], type: 'string' },
        target: {
          oneOf: [
            { additionalProperties: false, properties: { actionId: { minLength: 1, type: 'string' }, type: { const: 'game-action' } }, required: ['type', 'actionId'], type: 'object' },
            { additionalProperties: false, properties: { macroId: { minLength: 1, type: 'string' }, type: { const: 'macro' } }, required: ['type', 'macroId'], type: 'object' }
          ]
        }
      },
      required: ['target'],
      type: 'object'
    },
    name: 'controls.execute'
  }

  public constructor (private readonly commands: Commands) {}

  public readonly execute = async (arguments_: JsonObject, context: Parameters<LocalTool['execute']>[1]) => {
    const result = await this.commands.execute({
      operation: optionalStringArgument(arguments_, 'operation') ?? 'tap',
      target: CommandTargetSchema.parse(arguments_.target)
    }, 'copilot', context.signal)
    return output(result.message, json(result))
  }
}
