import type { JsonObject, LocalTool } from '@judus/llm-client'
import type { StationQuery } from './tool-gateways.js'

export class StationsLookupTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Find stations by a full or partially remembered station name near the commander. Returns matching station identity, system, distance, type, pad size, economies, government, services, and report timestamp. Uses the current system unless systemName is supplied.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        limit: { maximum: 20, minimum: 1, type: 'integer' },
        maxDistance: { maximum: 500, minimum: 1, type: 'integer' },
        minimumPadSize: { enum: ['small', 'medium', 'large'], type: 'string' },
        name: { minLength: 1, type: 'string' },
        stationType: { enum: ['any', 'orbital', 'surface', 'carrier'], type: 'string' },
        systemName: { minLength: 1, type: 'string' }
      },
      required: ['name'],
      type: 'object'
    },
    name: 'stations.lookup'
  }

  public constructor (private readonly stations: StationQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.stations.lookup(arguments_)
}
