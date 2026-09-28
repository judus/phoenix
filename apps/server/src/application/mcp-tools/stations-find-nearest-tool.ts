import type { JsonObject, LocalTool } from '@jdu/llm-client'
import { NEAREST_STATION_SERVICES } from '@phoenix/contracts'
import type { StationQuery } from './tool-gateways.js'

const services = NEAREST_STATION_SERVICES

export class StationsFindNearestTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Find nearby stations providing one supported service. Uses the commander\'s current system unless systemName is supplied.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        limit: { maximum: 20, minimum: 1, type: 'integer' },
        minimumPadSize: { enum: ['small', 'medium', 'large'], type: 'string' },
        service: { enum: services, type: 'string' },
        systemName: { type: 'string' }
      },
      required: ['service'],
      type: 'object'
    },
    name: 'stations.find_nearest_service'
  }
  public constructor (private readonly stations: StationQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.stations.findNearest(arguments_)
}
