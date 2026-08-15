import type { JsonObject, LocalTool } from '@judus/llm-client'
import type { StationQuery } from './tool-gateways.js'

export class OutfittingFindModuleTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Find nearby stations reported to sell a specific outfitting module. Accepts exact Elite labels such as "6A Power Plant" or a broad module name such as "Power Plant". Uses the commander\'s current system unless systemName is supplied.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        limit: { maximum: 20, minimum: 1, type: 'integer' },
        maxDaysAgo: { maximum: 365, minimum: 1, type: 'integer' },
        maxDistance: { maximum: 500, minimum: 1, type: 'integer' },
        minimumPadSize: { enum: ['small', 'medium', 'large'], type: 'string' },
        query: { minLength: 1, type: 'string' },
        systemName: { minLength: 1, type: 'string' }
      },
      required: ['query'],
      type: 'object'
    },
    name: 'outfitting.find_module'
  }

  public constructor (private readonly stations: StationQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.stations.findOutfitting(arguments_)
}
