import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { Commands } from '../../domain/commands.js'
import { json, optionalIntegerArgument, optionalStringArgument, output, stringArgument } from './tool-support.js'

const STOP_WORDS = new Set(['a', 'an', 'for', 'off', 'on', 'please', 'set', 'ship', 'switch', 'the', 'to', 'turn'])

export class ControlsFindActionsTool implements LocalTool {
  public readonly definition: LocalTool['definition'] = {
    annotations: { readOnly: true },
    description: 'Read-only discovery: find a small set of executable PHOENIX controls or commander-created macros by words from the request, label, command ID, description, target, or optional category. Questions such as "do you see", "can you find", "is there", or "list" authorize discovery only and must not be followed by execution. Use before controls.execute or controls.set_switch only when the commander separately asks to operate the control.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        category: { minLength: 1, type: 'string' },
        limit: { maximum: 20, minimum: 1, type: 'integer' },
        query: { minLength: 1, type: 'string' }
      },
      required: ['query'],
      type: 'object'
    },
    name: 'controls.find_actions'
  }

  public constructor (private readonly commands: Commands) {}

  public readonly execute = (arguments_: JsonObject) => {
    const query = stringArgument(arguments_, 'query')
    const normalized = query.toLowerCase().match(/[a-z0-9]+/g) ?? []
    const meaningful = normalized.filter(term => !STOP_WORDS.has(term))
    const terms = meaningful.length > 0 ? meaningful : normalized
    const category = optionalStringArgument(arguments_, 'category')
    const limit = optionalIntegerArgument(arguments_, 'limit') ?? 8
    const matches = this.commands.getCatalog().commands
      .filter(command => command.kind !== 'navigation')
      .filter(command => category === undefined || command.category === category)
      .filter(command => {
        const haystack = [command.id, command.label, command.description, command.category, JSON.stringify(command.target)].join(' ').toLowerCase()
        return terms.every(term => haystack.includes(term))
      })
      .slice(0, limit)
      .map(command => ({
        available: command.available,
        category: command.category,
        commandId: command.id,
        kind: command.kind,
        label: command.label,
        risk: command.risk,
        target: command.target,
        unavailableReason: command.unavailableReason
      }))
    const text = matches.length === 0
      ? `No controls or macros matched "${query}".`
      : ['Matching controls and macros:', ...matches.map(command => `- ${command.commandId}: ${command.label} (${command.kind}, ${command.risk}); ${command.available ? 'available' : `unavailable: ${command.unavailableReason}`}`)].join('\n')
    return output(text, json({ matches, query }))
  }
}
