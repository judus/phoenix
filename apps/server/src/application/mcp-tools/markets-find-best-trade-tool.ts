import type { JsonObject, LocalTool } from '@maduser/ai-ts'
import type { TradeMarketQuery } from './tool-gateways.js'

export class MarketsFindBestTradeTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'Find nearby commodity markets ranked by price, including percentage above or below reported average when available. Intent is required: buy means purchase cargo from a market; sell means sell the commander\'s cargo.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        commodity: { minLength: 1, type: 'string' },
        includeFleetCarriers: { type: 'boolean' },
        intent: { enum: ['buy', 'sell'], type: 'string' },
        limit: { maximum: 20, minimum: 1, type: 'integer' },
        maxDaysAgo: { maximum: 365, minimum: 1, type: 'integer' },
        maxDistance: { maximum: 500, minimum: 1, type: 'integer' },
        minVolume: { minimum: 1, type: 'integer' },
        systemName: { type: 'string' }
      },
      required: ['commodity', 'intent'],
      type: 'object'
    },
    name: 'markets.find_best_trade'
  }
  public constructor (private readonly markets: TradeMarketQuery) {}
  public readonly execute = (arguments_: JsonObject) => this.markets.findBestTrade(arguments_)
}
