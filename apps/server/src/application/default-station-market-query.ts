import type { JsonObject } from '@judus/llm-client'
import type {
  CartographicStation,
  GalaxyCommodityMarketsResponse,
  GalaxyNearbySystemsResponse,
  GalaxyNearestStationsResponse,
  GalaxyShipyardsResponse
} from '@phoenix/contracts'
import type { SystemCartography } from '../domain/cartography.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type {
  CommodityMarket,
  CommodityMarketRequest,
  NearbySystem,
  NearbySystemRequest,
  NearbyStation,
  NearestStationRequest,
  ProviderResponseCache,
  StationSearchSource,
  ShipyardSearchResult,
  ShipyardSearchSource,
  StationStockSource,
  StockItem
} from '../domain/station-market.js'
import type { StationQuery, TradeMarketQuery } from './mcp-tools/tool-gateways.js'
import {
  boundedLimit,
  json,
  optionalBooleanArgument,
  optionalIntegerArgument,
  optionalStringArgument,
  output,
  stringArgument
} from './mcp-tools/tool-support.js'

const MARKET_CACHE_MS = 5 * 60 * 1000
const NEARBY_SYSTEM_CACHE_MS = 30 * 60 * 1000
const NEAREST_CACHE_MS = 30 * 60 * 1000
const STOCK_CACHE_MS = 6 * 60 * 60 * 1000
const SHIPYARD_SEARCH_CACHE_MS = 30 * 60 * 1000
const PAD_SIZES: Record<string, number> = { small: 1, medium: 2, large: 3 }

interface CachedResult<T> {
  cache: 'fresh' | 'refreshed' | 'stale'
  value: T
}

interface ResolvedStation {
  station: CartographicStation
  systemName: string
  cache: 'fresh' | 'refreshed' | 'stale'
}

export class DefaultStationMarketQuery implements StationQuery, TradeMarketQuery {
  private readonly inFlight = new Map<string, Promise<unknown>>()

  public constructor (
    private readonly searchSource: StationSearchSource,
    private readonly stockSource: StationStockSource,
    private readonly shipyardSearchSource: ShipyardSearchSource,
    private readonly cartography: SystemCartography,
    private readonly runtimeState: RuntimeStateReader,
    private readonly cache: ProviderResponseCache,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async findBestTrade (arguments_: JsonObject) {
    const commodity = stringArgument(arguments_, 'commodity')
    const intent = stringArgument(arguments_, 'intent')
    if (intent !== 'buy' && intent !== 'sell') {
      throw new Error('intent must be buy or sell from the commander perspective.')
    }
    const systemName = this.originSystem(optionalStringArgument(arguments_, 'systemName'))
    const limit = boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 5, 20)
    const request = {
      commodity,
      includeFleetCarriers: optionalBooleanArgument(arguments_, 'includeFleetCarriers') ?? false,
      intent,
      maxDaysAgo: bounded(optionalIntegerArgument(arguments_, 'maxDaysAgo'), 30, 1, 365),
      maxDistance: bounded(optionalIntegerArgument(arguments_, 'maxDistance'), 100, 1, 500),
      minVolume: bounded(optionalIntegerArgument(arguments_, 'minVolume'), 1, 1, Number.MAX_SAFE_INTEGER),
      systemName
    } as const
    const result = await this.searchCommodityMarkets(request, limit)
    const markets = result.markets
    const verb = intent === 'sell' ? 'sell' : 'buy'
    if (markets.length === 0) {
      return output(`No nearby markets found to ${verb} ${commodity} from ${systemName}.`, {
        cache: result.cache, commodity, intent, markets: [], originSystem: systemName
      })
    }
    return output(
      [`Best nearby markets to ${verb} ${commodity} from ${systemName}:`, ...markets.map(market => formatMarket(market, intent))].join('\n'),
      json(result)
    )
  }

  public async findNearest (arguments_: JsonObject) {
    const service = stringArgument(arguments_, 'service')
    const systemName = this.originSystem(optionalStringArgument(arguments_, 'systemName'))
    const minimumPadSize = optionalStringArgument(arguments_, 'minimumPadSize')
    if (minimumPadSize && PAD_SIZES[minimumPadSize] === undefined) {
      throw new Error('minimumPadSize must be small, medium, or large.')
    }
    const padSize = minimumPadSize === 'small' || minimumPadSize === 'medium' || minimumPadSize === 'large'
      ? minimumPadSize
      : null
    const result = await this.searchNearestStations({
      minimumPadSize: padSize ? PAD_SIZES[padSize]! : null,
      service,
      systemName
    }, boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 5, 20), padSize)
    const stations = result.stations
    const header = `Nearest ${minimumPadSize ? `${minimumPadSize}-pad ` : ''}${service} stations from ${systemName}:`
    return output(
      stations.length > 0 ? [header, ...stations.map(formatNearbyStation)].join('\n') : `${header}\nNo matching stations found.`,
      json(result)
    )
  }

  public async findShipyards (arguments_: JsonObject) {
    const hullName = stringArgument(arguments_, 'hullName')
    const systemName = this.originSystem(optionalStringArgument(arguments_, 'systemName'))
    const result = await this.searchShipyards(
      hullName,
      systemName,
      boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 5, 20)
    )
    return output(
      result.shipyards.length > 0
        ? [`Nearest reported shipyards selling ${hullName} from ${systemName}:`, ...result.shipyards.map(shipyard => (
            `- ${shipyard.stationName} (${shipyard.systemName}) - ${formatDistance(shipyard.distanceLy, 'ly')}, ${formatDistance(shipyard.distanceToArrivalLs, 'ls')}; ${shipyard.price === null ? 'price unknown' : `${formatNumber(shipyard.price)} CR`}; ${shipyard.maxLandingPadSize ? `${padLabel(shipyard.maxLandingPadSize)} pad` : 'pad unknown'}`
          ))].join('\n')
        : `No nearby shipyards currently report selling ${hullName}.`,
      json(result)
    )
  }

  public async searchCommodityMarkets (
    request: CommodityMarketRequest,
    limit = 20
  ): Promise<GalaxyCommodityMarketsResponse> {
    const cached = await this.cached(
      'ardent-market',
      stableKey(request),
      MARKET_CACHE_MS,
      () => this.searchSource.findCommodityMarkets(request),
      isCommodityMarkets
    )
    return {
      cache: cached.cache,
      commodity: request.commodity,
      intent: request.intent,
      markets: cached.value.slice(0, boundedLimit(limit, 20, 100)),
      originSystem: request.systemName
    }
  }

  public async searchNearestStations (
    request: NearestStationRequest,
    limit = 20,
    minimumPadSize: 'small' | 'medium' | 'large' | null = null
  ): Promise<GalaxyNearestStationsResponse> {
    const cached = await this.cached(
      'ardent-nearest',
      stableKey(request),
      NEAREST_CACHE_MS,
      () => this.searchSource.findNearestStations(request),
      isNearbyStations
    )
    return {
      cache: cached.cache,
      minimumPadSize,
      originSystem: request.systemName,
      service: request.service,
      stations: cached.value.slice(0, boundedLimit(limit, 20, 100))
    }
  }

  public async searchNearbySystems (
    request: NearbySystemRequest,
    limit = 100
  ): Promise<GalaxyNearbySystemsResponse> {
    const cached = await this.cached(
      'ardent-nearby-systems',
      stableKey(request),
      NEARBY_SYSTEM_CACHE_MS,
      () => this.searchSource.findNearbySystems(request),
      isNearbySystems
    )
    return {
      cache: cached.cache,
      maxDistanceLy: request.maxDistance,
      originSystem: request.systemName,
      systems: cached.value.slice(0, boundedLimit(limit, 100, 1000))
    }
  }

  public async searchShipyards (
    hullName: string,
    systemName: string,
    limit = 20
  ): Promise<GalaxyShipyardsResponse> {
    const origin = await this.cartography.getSystem(systemName)
    if (!origin.system.position) throw new Error(`Coordinates for ${systemName} are unavailable.`)
    const request = { hullName, referencePosition: origin.system.position }
    const cached = await this.cached(
      'spansh-shipyards',
      stableKey({ hullName, systemName }),
      SHIPYARD_SEARCH_CACHE_MS,
      () => this.shipyardSearchSource.findShipyards(request),
      isShipyardSearchResults
    )
    return {
      cache: cached.cache,
      hullName,
      originSystem: origin.system.name,
      shipyards: cached.value.slice(0, boundedLimit(limit, 20, 100))
    }
  }

  public async getDetails (arguments_: JsonObject) {
    const resolved = await this.resolveStation(arguments_)
    const station = resolved.station
    const services = stationServices(station)
    return output([
      `Station: ${station.name} (${resolved.systemName})`,
      `Type: ${station.type ?? 'unknown'}; distance to arrival: ${formatDistance(station.distanceToArrival, 'ls')}`,
      `Allegiance: ${station.allegiance ?? 'unknown'}; controlling faction: ${station.controllingFaction ?? 'unknown'}`,
      `Economy: ${station.economy ?? 'unknown'}${station.secondEconomy && !sameName(station.secondEconomy, station.economy ?? '') ? ` / ${station.secondEconomy}` : ''}; government: ${station.government ?? 'unknown'}`,
      `Services: ${services.length > 0 ? services.join(', ') : 'none reported'}`
    ].join('\n'), json({ cache: resolved.cache, station: stationSummary(station, services), systemName: resolved.systemName }))
  }

  public async listShipyardStock (arguments_: JsonObject) {
    const resolved = await this.resolveStation(arguments_)
    if (!resolved.station.facilities.shipyard) {
      return output(`${resolved.station.name} (${resolved.systemName}) does not report a shipyard.`, {
        station: resolved.station.name, systemName: resolved.systemName, ships: []
      })
    }
    const marketId = requiredMarketId(resolved.station)
    const cached = await this.cached(
      'edsm-shipyard',
      String(marketId),
      STOCK_CACHE_MS,
      () => this.stockSource.getShipyard(marketId),
      isStockItems
    )
    return output(
      cached.value.length > 0
        ? [`Ships sold at ${resolved.station.name} (${resolved.systemName}):`, ...cached.value.map(ship => `- ${ship.name}`)].join('\n')
        : `No shipyard stock was reported for ${resolved.station.name} (${resolved.systemName}).`,
      json({ cache: cached.cache, marketId, ships: cached.value, station: resolved.station.name, systemName: resolved.systemName })
    )
  }

  public async searchOutfitting (arguments_: JsonObject) {
    const query = stringArgument(arguments_, 'query')
    const resolved = await this.resolveStation(arguments_)
    if (!resolved.station.facilities.outfitting) {
      return output(`${resolved.station.name} (${resolved.systemName}) does not report outfitting.`, {
        modules: [], query, station: resolved.station.name, systemName: resolved.systemName
      })
    }
    const marketId = requiredMarketId(resolved.station)
    const cached = await this.cached(
      'edsm-outfitting',
      String(marketId),
      STOCK_CACHE_MS,
      () => this.stockSource.getOutfitting(marketId),
      isStockItems
    )
    const normalized = query.toLocaleLowerCase()
    const modules = cached.value
      .filter(module => module.name.toLocaleLowerCase().includes(normalized))
      .slice(0, boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 20, 50))
    return output(
      modules.length > 0
        ? [`Outfitting matches at ${resolved.station.name} (${resolved.systemName}):`, ...modules.map(module => `- ${module.name}`)].join('\n')
        : `No outfitting matches for "${query}" at ${resolved.station.name} (${resolved.systemName}).`,
      json({ cache: cached.cache, marketId, modules, query, station: resolved.station.name, systemName: resolved.systemName })
    )
  }

  private originSystem (requested?: string): string {
    const systemName = requested ?? this.runtimeState.getCurrent().system.name
    if (!systemName) throw new Error('Current system is unavailable. Provide systemName explicitly.')
    return systemName
  }

  private async resolveStation (arguments_: JsonObject): Promise<ResolvedStation> {
    const state = this.runtimeState.getCurrent()
    const systemName = this.originSystem(optionalStringArgument(arguments_, 'systemName'))
    const requestedName = optionalStringArgument(arguments_, 'stationName')
      ?? (state.location.place?.kind === 'station' ? state.location.place.name : undefined)
    const requestedMarketId = optionalIntegerArgument(arguments_, 'marketId')
    if (!requestedName && requestedMarketId === undefined) {
      throw new Error('No station is selected. Provide stationName or marketId.')
    }
    const cartography = await this.cartography.getSystem(systemName)
    const station = cartography.system.stations.find(candidate => (
      requestedMarketId !== undefined
        ? candidate.marketId === requestedMarketId
        : requestedName !== undefined && sameName(candidate.name, requestedName)
    )) ?? localStation(state, systemName, requestedName, requestedMarketId)
    if (!station) {
      throw new Error(requestedName
        ? `Station "${requestedName}" was not found in ${systemName}.`
        : `Market ${requestedMarketId} was not found in ${systemName}.`)
    }
    return { cache: cartography.cache, station, systemName: cartography.system.name }
  }

  private async cached<T> (
    namespace: string,
    key: string,
    maxAgeMs: number,
    load: () => Promise<T>,
    validate: (candidate: unknown) => candidate is T
  ): Promise<CachedResult<T>> {
    const existing = this.cache.getProviderResponse(namespace, key)
    if (existing && validate(existing.value) && this.now().getTime() - Date.parse(existing.fetchedAt) <= maxAgeMs) {
      return { cache: 'fresh', value: existing.value }
    }
    const inFlightKey = `${namespace}:${key}`
    const active = this.inFlight.get(inFlightKey)
    try {
      const value = active ? await active : await this.refresh(inFlightKey, load)
      if (!validate(value)) throw new Error(`Invalid cached provider response for ${namespace}.`)
      return { cache: 'refreshed', value }
    } catch (cause) {
      if (existing && validate(existing.value)) return { cache: 'stale', value: existing.value }
      throw cause
    }
  }

  private refresh<T> (key: string, load: () => Promise<T>): Promise<T> {
    const request = load().then(value => {
      const [namespace, ...parts] = key.split(':')
      this.cache.putProviderResponse(namespace!, parts.join(':'), this.now().toISOString(), value)
      return value
    }).finally(() => this.inFlight.delete(key))
    this.inFlight.set(key, request)
    return request
  }
}

function localStation (
  state: ReturnType<RuntimeStateReader['getCurrent']>,
  systemName: string,
  requestedName?: string,
  requestedMarketId?: number
): CartographicStation | null {
  const place = state.location.place
  if (state.system.name && !sameName(state.system.name, systemName)) return null
  if (place?.kind !== 'station') return null
  if (requestedName && !sameName(place.name, requestedName)) return null
  if (requestedMarketId !== undefined && place.marketId !== requestedMarketId) return null
  const serviceNames = place.services.map(service => service.toLocaleLowerCase())
  return {
    allegiance: place.faction?.allegiance ?? null,
    controllingFaction: place.faction?.name ?? null,
    distanceToArrival: null,
    economy: place.primaryEconomy?.label ?? place.primaryEconomy?.id ?? null,
    facilities: {
      market: serviceNames.some(service => service.includes('commodit') || service === 'market'),
      outfitting: serviceNames.includes('outfitting'),
      shipyard: serviceNames.includes('shipyard')
    },
    government: place.government?.label ?? place.government?.id ?? null,
    id: null,
    marketId: place.marketId,
    name: place.name,
    raw: {},
    secondEconomy: place.economies[1]?.economy.label ?? place.economies[1]?.economy.id ?? null,
    services: place.services,
    type: place.type
  }
}

function stationServices (station: CartographicStation): string[] {
  return [...new Set([
    station.facilities.market ? 'Market' : null,
    station.facilities.shipyard ? 'Shipyard' : null,
    station.facilities.outfitting ? 'Outfitting' : null,
    ...station.services
  ].filter((value): value is string => value !== null))]
}

function stationSummary (station: CartographicStation, services: string[]) {
  return {
    id: station.id,
    marketId: station.marketId,
    name: station.name,
    type: station.type,
    distanceToArrival: station.distanceToArrival,
    allegiance: station.allegiance,
    government: station.government,
    economy: station.economy,
    secondEconomy: station.secondEconomy,
    controllingFaction: station.controllingFaction,
    facilities: station.facilities,
    services
  }
}

function requiredMarketId (station: CartographicStation): number {
  if (station.marketId === null) throw new Error(`${station.name} has no known market ID for stock lookup.`)
  return station.marketId
}

function formatNearbyStation (station: NearbyStation): string {
  const details = [station.stationType, station.maxLandingPadSize ? `${padLabel(station.maxLandingPadSize)} pad` : null]
    .filter(Boolean).join('; ')
  return `- ${station.stationName} (${station.systemName}) - ${formatDistance(station.distanceLy, 'ly')}, ${formatDistance(station.distanceToArrivalLs, 'ls')}${details ? `; ${details}` : ''}`
}

function formatMarket (market: CommodityMarket, intent: 'buy' | 'sell'): string {
  const price = intent === 'sell' ? market.sellPrice : market.buyPrice
  const volume = intent === 'sell' ? market.demand : market.stock
  const average = averageComparison(price, market.meanPrice)
  return `- ${market.stationName} (${market.systemName}) - ${formatDistance(market.distanceLy, 'ly')}, ${formatDistance(market.distanceToArrivalLs, 'ls')}; ${intent === 'sell' ? 'station pays' : 'purchase price'}: ${formatNumber(price)} CR${average}; ${intent === 'sell' ? 'demand' : 'supply'}: ${formatNumber(volume)} t`
}

function averageComparison (price: number | null, mean: number | null): string {
  if (price === null || mean === null || mean <= 0) return ''
  const percentage = ((price - mean) / mean) * 100
  if (Math.abs(percentage) < 0.05) return ` (at average of ${formatNumber(mean)} CR)`
  return ` (${formatNumber(Math.abs(percentage))}% ${percentage > 0 ? 'above' : 'below'} average of ${formatNumber(mean)} CR)`
}

function formatDistance (value: number | null, unit: string): string {
  return `${formatNumber(value)} ${unit}`
}

function formatNumber (value: number | null): string {
  return value === null ? 'unknown' : value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function padLabel (size: number): string {
  return ['small', 'medium', 'large'][size - 1] ?? 'unknown'
}

function bounded (value: number | undefined, fallback: number, minimum: number, maximum: number): number {
  return value === undefined ? fallback : Math.min(Math.max(value, minimum), maximum)
}

function stableKey (value: object): string {
  return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right))))
}

function sameName (left: string, right: string): boolean {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase()
}

function isNearbyStations (candidate: unknown): candidate is NearbyStation[] {
  return Array.isArray(candidate) && candidate.every(item => isRecord(item) && typeof item.stationName === 'string' && typeof item.systemName === 'string')
}

function isNearbySystems (candidate: unknown): candidate is NearbySystem[] {
  return Array.isArray(candidate) && candidate.every(item => (
    isRecord(item) &&
    typeof item.systemName === 'string' &&
    typeof item.distanceLy === 'number' &&
    Array.isArray(item.position) &&
    item.position.length === 3
  ))
}

function isCommodityMarkets (candidate: unknown): candidate is CommodityMarket[] {
  return Array.isArray(candidate) && candidate.every(item => isRecord(item) && typeof item.commodityName === 'string' && typeof item.stationName === 'string')
}

function isStockItems (candidate: unknown): candidate is StockItem[] {
  return Array.isArray(candidate) && candidate.every(item => isRecord(item) && typeof item.name === 'string')
}

function isShipyardSearchResults (candidate: unknown): candidate is ShipyardSearchResult[] {
  return Array.isArray(candidate) && candidate.every(item => (
    isRecord(item) &&
    typeof item.stationName === 'string' &&
    typeof item.systemName === 'string' &&
    typeof item.distanceLy === 'number'
  ))
}

function isRecord (candidate: unknown): candidate is Record<string, unknown> {
  return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
}
