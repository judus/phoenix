import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { FactionPresenceQuery } from './tool-gateways.js'

export class FactionsSearchTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Find community-reported factions near the current or supplied system. Omit factionName to search any faction; when supplied it is an exact name. Use states for OR matching, for example ["War", "Civil War"]. Filters apply to the same faction. Results are candidate systems, not live conflict zones or guaranteed salvage signals. Includes influence, active/pending/recovering states and report time.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        allegiance: { minLength: 1, type: 'string' },
        controlling: { enum: ['any', 'yes', 'no'], type: 'string' },
        factionName: { minLength: 1, type: 'string' },
        government: { minLength: 1, type: 'string' },
        limit: { maximum: 20, minimum: 1, type: 'integer' },
        maxDistance: { maximum: 500, minimum: 1, type: 'integer' },
        minInfluencePercent: { maximum: 100, minimum: 0, type: 'integer' },
        state: { minLength: 1, type: 'string' },
        states: { description: 'Reported faction states to match (OR). Overrides legacy state when supplied; empty means any.', items: { minLength: 1, type: 'string' }, type: 'array', uniqueItems: true },
        systemName: { minLength: 1, type: 'string' }
      },
      type: 'object'
    },
    name: 'factions.find_faction_presence'
  }

  public constructor (private readonly factions: FactionPresenceQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.factions.searchFactionPresences(arguments_)
}
