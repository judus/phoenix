import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { Commands } from '../../domain/commands.js'
import { json, optionalStringArgument, output, stringArgument } from './tool-support.js'

export class ControlsExecuteTool implements LocalTool {
  public readonly definition: LocalTool['definition'] = {
    annotations: { destructive: true, idempotent: false, openWorld: false },
    description: 'Execute one PHOENIX control or commander-created macro through the shared typed command gateway. Pass the exact commandId returned by controls.find_actions. Use only when the commander clearly asks to operate, press, run, activate, or otherwise execute it. Questions about whether a control exists, is visible, or can be found are never execution authorization. Completion reports command dispatch, not an invented physical outcome.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        leaseId: { description: 'Required gesture identifier for press/release pairs.', minLength: 1, type: 'string' },
        operation: { default: 'tap', enum: ['tap', 'press', 'release'], type: 'string' },
        commandId: { minLength: 1, type: 'string' }
      },
      required: ['commandId'],
      type: 'object'
    },
    name: 'controls.execute'
  }

  public constructor (private readonly commands: Commands) {}

  public readonly execute = async (arguments_: JsonObject, context: Parameters<LocalTool['execute']>[1]) => {
    const result = await this.commands.execute({
      ...(typeof arguments_.leaseId === 'string' ? { leaseId: arguments_.leaseId } : {}),
      commandId: stringArgument(arguments_, 'commandId'),
      operation: optionalStringArgument(arguments_, 'operation') ?? 'tap'
    }, 'copilot', context.signal)
    return output(result.message, json(result))
  }
}
