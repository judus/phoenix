import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { StationQuery } from './tool-gateways.js'

export class ShipsFindShipyardsTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Find nearby shipyards reported to sell one specific ship hull. Uses the commander\'s current system unless systemName is supplied. Results include price, travel distance, arrival distance, pad size, and report age.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        hullName: { minLength: 1, type: 'string' },
        limit: { maximum: 20, minimum: 1, type: 'integer' },
        systemName: { minLength: 1, type: 'string' }
      },
      required: ['hullName'],
      type: 'object'
    },
    name: 'ships.find_shipyards'
  }

  public constructor (private readonly stations: StationQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.stations.findShipyards(arguments_)
}
