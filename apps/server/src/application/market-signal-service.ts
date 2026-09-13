import type { GalaxyMarketSignal, GalaxyMarketSignalsResponse } from '@phoenix/contracts'
import type {
  CommodityMarket,
  CommodityReport,
  MarketSignalRequest,
  ProviderResponseCache,
  StationSearchSource
} from '../domain/station-market.js'
import { DEFAULT_GALAXY_RESULT_LIMIT } from './galaxy-data-service.js'
import { ProviderQueryCache } from './provider-query-cache.js'

const MARKET_SIGNAL_CACHE_MS = 5 * 60 * 1000

interface MarketSignalSourceData {
  markets: Array<{ market: CommodityMarket, side: 'buy' | 'sell' }>
  reports: CommodityReport[]
}

export interface MarketSignalReader {
  searchMarketSignals(request: MarketSignalRequest, limit?: number): Promise<GalaxyMarketSignalsResponse>
}

export class MarketSignalService implements MarketSignalReader {
  private readonly providerQueries: ProviderQueryCache

  public constructor (
    private readonly source: StationSearchSource,
    cache: ProviderResponseCache,
    now: () => Date = () => new Date()
  ) {
    this.providerQueries = new ProviderQueryCache(cache, now)
  }

  public async searchMarketSignals (
    request: MarketSignalRequest,
    limit = DEFAULT_GALAXY_RESULT_LIMIT
  ): Promise<GalaxyMarketSignalsResponse> {
    const normalized = normalizeRequest(request)
    const cached = await this.providerQueries.get(
      'ardent-market-signals',
      stableKey(normalized),
      MARKET_SIGNAL_CACHE_MS,
      () => this.load(normalized),
      isMarketSignalSourceData
    )
    return {
      cache: cached.cache,
      caveat: `Current-system comparison against Ardent's daily non-carrier average prices. Reports may be stale and stock or demand may change before arrival.`,
      filters: {
        includeFleetCarriers: normalized.includeFleetCarriers,
        maxDaysAgo: normalized.maxDaysAgo,
        minDeviationPercent: normalized.minDeviationPercent,
        minimumPadSize: padName(normalized.minimumPadSize),
        minVolume: normalized.minVolume,
        sides: normalized.sides
      },
      originSystem: normalized.systemName,
      provenance: 'Ardent Insight community market reports',
      schemaVersion: 1,
      scope: 'current-system',
      signals: rankSignals(cached.value, normalized)
        .slice(0, Math.min(Math.max(Math.trunc(limit), 1), DEFAULT_GALAXY_RESULT_LIMIT))
    }
  }

  private async load(request: MarketSignalRequest): Promise<MarketSignalSourceData> {
    const sourceRequest = {
      includeFleetCarriers: request.includeFleetCarriers,
      maxDaysAgo: request.maxDaysAgo,
      minVolume: request.minVolume,
      systemName: request.systemName
    }
    const [reports, exports, imports] = await Promise.all([
      this.source.getCommodityReports(),
      request.sides.includes('buy') ? this.source.findSystemExports(sourceRequest) : Promise.resolve([]),
      request.sides.includes('sell') ? this.source.findSystemImports(sourceRequest) : Promise.resolve([])
    ])
    return {
      markets: [
        ...exports.map(market => ({ market, side: 'buy' as const })),
        ...imports.map(market => ({ market, side: 'sell' as const }))
      ],
      reports
    }
  }
}

function rankSignals(data: MarketSignalSourceData, request: MarketSignalRequest): GalaxyMarketSignal[] {
  const reports = reportIndex(data.reports)
  const best = new Map<string, GalaxyMarketSignal>()
  for (const candidate of data.markets) {
    const signal = marketSignal(candidate.market, candidate.side, reports, request)
    if (!signal) continue
    const key = `${signal.side}:${commodityKey(signal.commoditySymbol)}`
    const existing = best.get(key)
    if (!existing || compareSignals(signal, existing) < 0) best.set(key, signal)
  }
  return [...best.values()].sort(compareSignals)
}

function marketSignal(
  market: CommodityMarket,
  side: 'buy' | 'sell',
  reports: Map<string, CommodityReport>,
  request: MarketSignalRequest
): GalaxyMarketSignal | null {
  if (request.minimumPadSize !== null && (market.maxLandingPadSize === null || market.maxLandingPadSize < request.minimumPadSize)) return null
  if (!market.updatedAt) return null
  const report = reports.get(commodityKey(market.commoditySymbol))
  if (!report?.updatedAt) return null
  const price = side === 'buy' ? market.buyPrice : market.sellPrice
  const baselinePrice = side === 'buy' ? report.avgBuyPrice : report.avgSellPrice
  const volume = side === 'buy' ? market.stock : market.demand
  const unlimitedVolume = side === 'sell' && volume === 0
  if (price === null || price <= 0 || baselinePrice === null || baselinePrice <= 0 || volume === null) return null
  if (!unlimitedVolume && volume < request.minVolume) return null
  const deviationPercent = side === 'buy'
    ? ((baselinePrice - price) / baselinePrice) * 100
    : ((price - baselinePrice) / baselinePrice) * 100
  if (deviationPercent < request.minDeviationPercent) return null
  return {
    baselinePrice,
    baselineUpdatedAt: report.updatedAt,
    commodityName: market.commodityName,
    commoditySymbol: market.commoditySymbol,
    deviationPercent,
    distanceLy: 0,
    distanceToArrivalLs: market.distanceToArrivalLs,
    marketId: market.marketId,
    maxLandingPadSize: market.maxLandingPadSize,
    price,
    provider: 'Ardent Insight',
    side,
    stationName: market.stationName,
    stationType: market.stationType,
    systemName: market.systemName,
    unlimitedVolume,
    updatedAt: market.updatedAt,
    volume
  }
}

function reportIndex(reports: CommodityReport[]): Map<string, CommodityReport> {
  const index = new Map<string, CommodityReport>()
  for (const report of reports) {
    index.set(commodityKey(report.commoditySymbol), report)
  }
  return index
}

function compareSignals(left: GalaxyMarketSignal, right: GalaxyMarketSignal): number {
  return right.deviationPercent - left.deviationPercent ||
    Number(right.unlimitedVolume) - Number(left.unlimitedVolume) ||
    right.volume - left.volume ||
    Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
    left.commodityName.localeCompare(right.commodityName)
}

function normalizeRequest(request: MarketSignalRequest): MarketSignalRequest {
  const sides = [...new Set(request.sides)].filter(side => side === 'buy' || side === 'sell').sort()
  if (sides.length === 0) throw new Error('At least one market signal side is required.')
  return {
    includeFleetCarriers: request.includeFleetCarriers,
    maxDaysAgo: boundedInteger(request.maxDaysAgo, 1, 365),
    minDeviationPercent: boundedNumber(request.minDeviationPercent, 0.1, 1_000),
    minimumPadSize: request.minimumPadSize === null ? null : boundedInteger(request.minimumPadSize, 1, 3),
    minVolume: boundedInteger(request.minVolume, 1, Number.MAX_SAFE_INTEGER),
    sides,
    systemName: request.systemName.trim()
  }
}

function padName(value: number | null): 'small' | 'medium' | 'large' | null {
  return value === null ? null : ['small', 'medium', 'large'][value - 1] as 'small' | 'medium' | 'large'
}

function boundedInteger(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(Math.trunc(value), minimum), maximum)
}

function boundedNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

function stableKey(value: object): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))))
}

function commodityKey(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function isMarketSignalSourceData(candidate: unknown): candidate is MarketSignalSourceData {
  if (!isRecord(candidate) || !Array.isArray(candidate.markets) || !Array.isArray(candidate.reports)) return false
  return candidate.markets.every(item => isRecord(item) && (item.side === 'buy' || item.side === 'sell') && isCommodityMarket(item.market)) &&
    candidate.reports.every(isCommodityReport)
}

function isCommodityMarket(candidate: unknown): candidate is CommodityMarket {
  return isRecord(candidate) && typeof candidate.commodityName === 'string' && typeof candidate.commoditySymbol === 'string' && typeof candidate.stationName === 'string' && typeof candidate.systemName === 'string'
}

function isCommodityReport(candidate: unknown): candidate is CommodityReport {
  return isRecord(candidate) && typeof candidate.commodityName === 'string' && typeof candidate.commoditySymbol === 'string'
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
}
