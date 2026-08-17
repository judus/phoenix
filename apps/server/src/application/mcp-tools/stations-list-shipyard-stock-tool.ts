import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { StationQuery } from './tool-gateways.js'
import { stationReferenceSchema } from './station-reference-schema.js'

export class StationsListShipyardStockTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'List ships sold at a known station. Defaults to the currently docked station.',
    inputSchema: stationReferenceSchema,
    name: 'stations.list_shipyard_stock'
  }
  public constructor (private readonly stations: StationQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.stations.listShipyardStock(arguments_)
}
