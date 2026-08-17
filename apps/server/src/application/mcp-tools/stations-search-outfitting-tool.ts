import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { StationQuery } from './tool-gateways.js'

export class StationsSearchOutfittingTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Search module stock at a known station. Defaults to the currently docked station.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        limit: { maximum: 50, minimum: 1, type: 'integer' },
        marketId: { minimum: 0, type: 'integer' },
        query: { minLength: 1, type: 'string' },
        stationName: { type: 'string' },
        systemName: { type: 'string' }
      },
      required: ['query'],
      type: 'object'
    },
    name: 'stations.search_outfitting'
  }
  public constructor (private readonly stations: StationQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.stations.searchOutfitting(arguments_)
}
