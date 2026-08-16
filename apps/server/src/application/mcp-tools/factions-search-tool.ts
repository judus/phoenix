import type { JsonObject, LocalTool } from '@judus/llm-client'
import type { FactionPresenceQuery } from './tool-gateways.js'

export class FactionsSearchTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Find the community-reported presence of an exact minor-faction name near the current or supplied reference system. Filter by distance, minimum influence percentage, allegiance, government, current state, or whether the faction controls the system. Results include influence, active/pending/recovering states, controlling status, and the system report time. These are community reports, not live authoritative game state.',
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
        systemName: { minLength: 1, type: 'string' }
      },
      required: ['factionName'],
      type: 'object'
    },
    name: 'factions.search'
  }

  public constructor (private readonly factions: FactionPresenceQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.factions.searchFactionPresences(arguments_)
}
