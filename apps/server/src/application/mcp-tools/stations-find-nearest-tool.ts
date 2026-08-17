import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { StationQuery } from './tool-gateways.js'

const services = ['black-market', 'interstellar-factors', 'material-trader', 'outfitting', 'refuel', 'repair', 'search-and-rescue', 'shipyard', 'technology-broker', 'universal-cartographics']

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
    name: 'stations.find_nearest'
  }
  public constructor (private readonly stations: StationQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.stations.findNearest(arguments_)
}
