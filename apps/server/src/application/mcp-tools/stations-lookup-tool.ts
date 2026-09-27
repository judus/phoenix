import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { StationQuery } from './tool-gateways.js'

export class StationsLookupTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Find stations galaxy-wide by a full or partially remembered station name. Only name is required; no radius, pad, or type restriction is applied by default. Returns station identity, system, distance, type, pads, services, and report timestamp. Current system supplies distance context when known; systemName overrides that context. Optional filters are for explicitly narrowed searches, not ordinary name lookup.',
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
    name: 'stations.find_stations_by_name'
  }

  public constructor (private readonly stations: StationQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.stations.lookup(arguments_)
}
