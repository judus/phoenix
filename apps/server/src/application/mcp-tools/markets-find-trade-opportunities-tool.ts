import type { JsonObject, LocalTool } from '@jdu/llm-client'
import type { TradeMarketQuery } from './tool-gateways.js'

export class MarketsFindTradeOpportunitiesTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Compare best-effort profitable cargo movements that buy reported exports in the origin system and sell to nearby markets. Use this for general trading opportunities when no commodity has been chosen. Community market reports may be stale and the result is not a guaranteed route.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        availableCredits: { minimum: 1, type: 'integer' },
        cargoCapacity: { maximum: 10000, minimum: 1, type: 'integer' },
        includeFleetCarriers: { type: 'boolean' },
        limit: { maximum: 20, minimum: 1, type: 'integer' },
        maxDaysAgo: { maximum: 365, minimum: 1, type: 'integer' },
        maxDistance: { maximum: 500, minimum: 1, type: 'integer' },
        minVolume: { minimum: 1, type: 'integer' },
        systemName: { type: 'string' }
      },
      type: 'object'
    },
    name: 'markets.find_trade_opportunities'
  }
  public constructor (private readonly markets: TradeMarketQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.markets.findTradeOpportunities(arguments_)
}
