import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { ExplorationTargetQuery } from './tool-gateways.js'

export class ExplorationSearchTargetsTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Find community-reported exploration body candidates near the current or supplied system. Filter physical characteristics and require reported biological or geological signal counts. Results distinguish external reports from exact local journal evidence. This bounded search does not prove a body is unvisited or unfinished.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        atmospheres: { items: { minLength: 1, type: 'string' }, type: 'array' },
        bodySubtypes: { items: { minLength: 1, type: 'string' }, type: 'array' },
        landable: { enum: ['any', 'yes', 'no'], type: 'string' }, limit: { maximum: 20, minimum: 1, type: 'integer' },
        lastReportedBefore: { description: 'Latest accepted community body-report date in YYYY-MM-DD format. Use 2021-05-19 with zero required biological signals to inspect pre-Odyssey cartography candidates.', pattern: '^\\d{4}-\\d{2}-\\d{2}$', type: 'string' },
        maxDistance: { maximum: 500, minimum: 1, type: 'integer' }, maxGravityG: { minimum: 0, type: 'number' },
        maxTemperatureK: { minimum: 0, type: 'number' }, minBiologicalSignals: { minimum: 0, type: 'integer' },
        minGeologicalSignals: { minimum: 0, type: 'integer' }, minGravityG: { minimum: 0, type: 'number' },
        minTemperatureK: { minimum: 0, type: 'number' }, systemName: { minLength: 1, type: 'string' },
        volcanismTypes: { items: { minLength: 1, type: 'string' }, type: 'array' }
      }, type: 'object'
    },
    name: 'exploration.search_targets'
  }
  public constructor (private readonly exploration: ExplorationTargetQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.exploration.searchTargets(arguments_)
}
