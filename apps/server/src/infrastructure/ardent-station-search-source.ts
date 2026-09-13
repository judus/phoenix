import type {
  CommodityMarket,
  CommodityMarketRequest,
  CommodityReport,
  NearbyStation,
  NearestStationRequest,
  StationSearchSource,
  TradeOpportunityRequest
} from '../domain/station-market.js'

const DEFAULT_BASE_URL = 'https://api.ardent-insight.com/v2/'
const DEFAULT_TIMEOUT_MS = 10_000

export interface ArdentStationSearchSourceOptions {
  baseUrl?: string
  fetch?: typeof fetch
  resolveCommodity: (identifier: string) => { displayName: string, symbol: string } | null
  timeoutMs?: number
}

export class ArdentStationSearchSource implements StationSearchSource {
  private readonly baseUrl: URL
  private readonly fetcher: typeof fetch
  private readonly resolveCommodity: NonNullable<ArdentStationSearchSourceOptions['resolveCommodity']>
  private readonly timeoutMs: number

  public constructor (options: ArdentStationSearchSourceOptions) {
    this.baseUrl = new URL(options.baseUrl ?? DEFAULT_BASE_URL)
    this.fetcher = options.fetch ?? globalThis.fetch
    this.resolveCommodity = options.resolveCommodity
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  public async findNearestStations (request: NearestStationRequest): Promise<NearbyStation[]> {
    const payload = await this.get(
      `system/name/${encodeURIComponent(request.systemName)}/nearest/${encodeURIComponent(request.service)}`,
      { minLandingPadSize: request.minimumPadSize }
    )
    return payload.map(mapNearbyStation).filter(isPresent)
  }

  public async findCommodityMarkets (request: CommodityMarketRequest): Promise<CommodityMarket[]> {
    const direction = request.intent === 'sell' ? 'imports' : 'exports'
    const payload = await this.get(
      `system/name/${encodeURIComponent(request.systemName)}/commodity/name/${encodeURIComponent(request.commodity)}/nearby/${direction}`,
      {
        fleetCarriers: request.includeFleetCarriers,
        maxDaysAgo: request.maxDaysAgo,
        maxDistance: request.maxDistance,
        minVolume: request.minVolume
      }
    )
    return payload.map(candidate => mapCommodityMarket(candidate, this.resolveCommodity)).filter(isPresent)
  }

  public async findSystemExports (
    request: Omit<TradeOpportunityRequest, 'availableCredits' | 'cargoCapacity' | 'maxDistance'>
  ): Promise<CommodityMarket[]> {
    const payload = await this.get(
      `system/name/${encodeURIComponent(request.systemName)}/commodities/exports`,
      {
        fleetCarriers: request.includeFleetCarriers,
        maxDaysAgo: request.maxDaysAgo,
        minVolume: request.minVolume
      }
    )
    return payload.map(candidate => mapCommodityMarket(candidate, this.resolveCommodity)).filter(isPresent)
  }

  public async findSystemImports (
    request: Omit<TradeOpportunityRequest, 'availableCredits' | 'cargoCapacity' | 'maxDistance'>
  ): Promise<CommodityMarket[]> {
    const payload = await this.get(
      `system/name/${encodeURIComponent(request.systemName)}/commodities/imports`,
      {
        fleetCarriers: request.includeFleetCarriers,
        maxDaysAgo: request.maxDaysAgo,
        minVolume: request.minVolume
      }
    )
    return payload.map(candidate => mapCommodityMarket(candidate, this.resolveCommodity)).filter(isPresent)
  }

  public async getCommodityReports (): Promise<CommodityReport[]> {
    const payload = await this.get('commodities', {})
    return payload.map(candidate => mapCommodityReport(candidate, this.resolveCommodity)).filter(isPresent)
  }

  private async get (path: string, query: Record<string, boolean | number | null>): Promise<unknown[]> {
    const url = new URL(path, this.baseUrl)
    for (const [key, value] of Object.entries(query)) {
      if (value !== null) url.searchParams.set(key, String(value))
    }
    const response = await this.fetcher(url, {
      headers: { accept: 'application/json', 'user-agent': 'phoenix-terminal/0.1' },
      signal: AbortSignal.timeout(this.timeoutMs)
    })
    if (!response.ok) throw new Error(`Ardent request failed with HTTP ${response.status}.`)
    const payload: unknown = await response.json()
    if (!Array.isArray(payload)) throw new Error('Ardent returned an unexpected response.')
    return payload
  }
}

function mapNearbyStation (candidate: unknown): NearbyStation | null {
  const raw = record(candidate)
  const stationName = stringValue(raw?.stationName)
  const systemName = stringValue(raw?.systemName)
  if (!raw || !stationName || !systemName) return null
  return {
    allegiance: stringValue(raw.allegiance),
    controllingFaction: stringValue(raw.controllingFaction),
    distanceLy: nonnegativeNumber(raw.distance),
    distanceToArrivalLs: nonnegativeNumber(raw.distanceToArrival),
    government: stringValue(raw.government),
    marketId: integerValue(raw.marketId),
    maxLandingPadSize: integerValue(raw.maxLandingPadSize),
    primaryEconomy: stringValue(raw.primaryEconomy),
    secondaryEconomy: stringValue(raw.secondaryEconomy),
    stationName,
    stationType: stringValue(raw.stationType),
    systemName,
    updatedAt: isoString(raw.updatedAt)
  }
}

function mapCommodityMarket (
  candidate: unknown,
  resolveCommodity: NonNullable<ArdentStationSearchSourceOptions['resolveCommodity']>
): CommodityMarket | null {
  const raw = record(candidate)
  const providerSymbol = stringValue(raw?.commodityName)
  const stationName = stringValue(raw?.stationName)
  const systemName = stringValue(raw?.systemName)
  if (!raw || !providerSymbol || !stationName || !systemName) return null
  const commodity = resolveCommodity(providerSymbol)
  return {
    buyPrice: nonnegativeNumber(raw.buyPrice),
    commodityName: commodity?.displayName ?? providerSymbol,
    commoditySymbol: commodity?.symbol ?? providerSymbol,
    demand: nonnegativeNumber(raw.demand),
    distanceLy: nonnegativeNumber(raw.distance),
    distanceToArrivalLs: nonnegativeNumber(raw.distanceToArrival),
    marketId: integerValue(raw.marketId),
    maxLandingPadSize: integerValue(raw.maxLandingPadSize),
    meanPrice: nonnegativeNumber(raw.meanPrice),
    sellPrice: nonnegativeNumber(raw.sellPrice),
    stationName,
    stationType: stringValue(raw.stationType),
    stock: nonnegativeNumber(raw.stock),
    systemName,
    updatedAt: isoString(raw.updatedAt)
  }
}

function mapCommodityReport (
  candidate: unknown,
  resolveCommodity: NonNullable<ArdentStationSearchSourceOptions['resolveCommodity']>
): CommodityReport | null {
  const raw = record(candidate)
  const providerSymbol = stringValue(raw?.commodityName)
  if (!raw || !providerSymbol) return null
  const commodity = resolveCommodity(providerSymbol)
  return {
    avgBuyPrice: nonnegativeNumber(raw.avgBuyPrice),
    avgSellPrice: nonnegativeNumber(raw.avgSellPrice),
    commodityName: commodity?.displayName ?? providerSymbol,
    commoditySymbol: commodity?.symbol ?? providerSymbol,
    maxSellPrice: nonnegativeNumber(raw.maxSellPrice),
    updatedAt: isoString(raw.timestamp)
  }
}

function record (candidate: unknown): Record<string, unknown> | null {
  return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : null
}

function stringValue (candidate: unknown): string | null {
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

function isoString (candidate: unknown): string | null {
  const value = stringValue(candidate)
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null
}

function nonnegativeNumber (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 ? candidate : null
}

function finiteNumber (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null
}

function integerValue (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : null
}

function isPresent<T> (value: T | null): value is T {
  return value !== null
}
