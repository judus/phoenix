import type { JsonObject, LocalTool } from '@jdu/llm-client'
import { CommandTargetSchema } from '@phoenix/contracts'
import type { Commands } from '../../domain/commands.js'
import { json, optionalStringArgument, output, ToolArgumentError } from './tool-support.js'
import { assertControlExecution } from './control-execution-errors.js'

export class ControlsExecuteTool implements LocalTool {
  public readonly definition: LocalTool['definition'] = {
    annotations: { destructive: true, idempotent: false, openWorld: false },
    description: 'Execute one PHOENIX control or commander-created macro through the shared typed command gateway. Pass the exact target returned by controls.find_actions. Use only when the commander clearly asks to operate, press, run, activate, or otherwise execute it. Questions about whether a control exists, is visible, or can be found are never execution authorization. Completion reports command dispatch, not an invented physical outcome.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        leaseId: { description: 'Required gesture identifier for press/release pairs.', minLength: 1, type: 'string' },
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
    name: 'controls.execute_command'
  }

  public constructor (private readonly commands: Commands) {}

  public readonly execute = async (arguments_: JsonObject, context: Parameters<LocalTool['execute']>[1]) => {
    const target = CommandTargetSchema.parse(arguments_.target)
    const operation = optionalStringArgument(arguments_, 'operation') ?? 'tap'
    const leaseId = optionalStringArgument(arguments_, 'leaseId')
    if (target.type === 'macro' && operation !== 'tap') {
      throw new ToolArgumentError('Macros only support tap execution.', 'Set operation to tap for a macro target.')
    }
    if ((operation === 'press' || operation === 'release') && !leaseId) {
      throw new ToolArgumentError('Press/release execution requires leaseId.', 'Provide the same non-empty leaseId for the corresponding press and release calls.')
    }
    const result = await this.commands.execute({
      ...(leaseId ? { leaseId } : {}),
      operation,
      target
    }, 'copilot', context.signal)
    assertControlExecution(this.definition.name, result)
    return output(result.message, json(result))
  }
}
