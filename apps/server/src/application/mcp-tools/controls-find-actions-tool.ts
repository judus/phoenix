import type { JsonObject, LocalTool } from '@judus/llm-client'
import type { GameActionCategory } from '@phoenix/contracts'
import type { GameActions } from '../game-action-service.js'
import { optionalIntegerArgument, optionalStringArgument, output, stringArgument } from './tool-support.js'

const STOP_WORDS = new Set(['a', 'an', 'for', 'off', 'on', 'please', 'set', 'ship', 'switch', 'the', 'to', 'turn'])

export class ControlsFindActionsTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Find a small set of PHOENIX game actions by words from the commander request, label, action ID, description, or optional category. Use before controls.execute or controls.set_switch when the exact action ID is unknown.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        category: { enum: ['ship', 'combat', 'navigation', 'srv', 'on_foot', 'vessel', 'radio', 'emote', 'system', 'misc'], type: 'string' },
        limit: { maximum: 20, minimum: 1, type: 'integer' },
        query: { minLength: 1, type: 'string' }
      },
      required: ['query'],
      type: 'object'
    },
    name: 'controls.find_actions'
  }

  public constructor (private readonly gameActions: GameActions) {}

  public readonly execute = (arguments_: JsonObject) => {
    const query = stringArgument(arguments_, 'query')
    const normalized = query.toLowerCase().match(/[a-z0-9]+/g) ?? []
    const meaningful = normalized.filter(term => !STOP_WORDS.has(term))
    const terms = meaningful.length > 0 ? meaningful : normalized
    const category = optionalStringArgument(arguments_, 'category') as GameActionCategory | undefined
    const limit = optionalIntegerArgument(arguments_, 'limit') ?? 8
    const matches = this.gameActions.getCatalog().actions
      .filter(action => category === undefined || action.definition.category === category)
      .filter(action => {
        const haystack = [action.definition.id, action.definition.label, action.definition.description, action.definition.eliteBinding].join(' ').toLowerCase()
        return terms.every(term => haystack.includes(term))
      })
      .slice(0, limit)
      .map(action => ({
        actionId: action.definition.id,
        available: action.available,
        binding: action.binding?.display ?? null,
        category: action.definition.category,
        inputMode: action.definition.inputMode,
        label: action.definition.label,
        risk: action.definition.risk,
        telemetryKey: action.definition.telemetryKey,
        unavailableReason: action.unavailableReason
      }))
    const text = matches.length === 0 ? `No game actions matched "${query}".` : ['Matching game actions:', ...matches.map(action => `- ${action.actionId}: ${action.label} (${action.category}, ${action.inputMode}, ${action.risk}); ${action.available ? `available${action.binding ? ` on ${action.binding}` : ''}` : `unavailable: ${action.unavailableReason}`}`)].join('\n')
    return output(text, { matches, query })
  }
}
