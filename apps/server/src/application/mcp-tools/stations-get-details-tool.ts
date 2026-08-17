import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { StationQuery } from './tool-gateways.js'
import { stationReferenceSchema } from './station-reference-schema.js'

export class StationsGetDetailsTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Return services, economy, faction, station type, and distance to arrival for a known station. Defaults to the currently docked station.',
    inputSchema: stationReferenceSchema,
    name: 'stations.get_details'
  }
  public constructor (private readonly stations: StationQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.stations.getDetails(arguments_)
}
