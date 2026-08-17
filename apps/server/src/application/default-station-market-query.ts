import type { JsonObject } from '@jdu/llm-client'
import type {
  CartographicStation,
  GalaxyCommodityMarketsResponse,
  GalaxyFactionPresencesResponse,
  GalaxyFilteredSystemsResponse,
  GalaxyNearbySystemsResponse,
  GalaxyNearestStationsResponse,
  GalaxyOutfittingResponse,
  GalaxyStationLookupResponse,
  GalaxyShipyardsResponse,
  GalaxyTradeOpportunity,
  GalaxyTradeOpportunitiesResponse
} from '@phoenix/contracts'
import type { SystemCartography } from '../domain/cartography.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type {
  CommodityMarket,
  CommodityMarketRequest,
  FactionControllingFilter,
  FactionPresenceRequest,
  FactionPresenceResult,
  FactionPresenceSearchSource,
  FilteredSystemRequest,
  FilteredSystemResult,
  NearbySystem,
  NearbySystemRequest,
  NearbyStation,
  NearestStationRequest,
  OutfittingSearchResult,
  OutfittingSearchSource,
  ProviderResponseCache,
  StationSearchSource,
  StationLocationType,
  StationLookupResult,
  StationLookupSource,
  ShipyardSearchResult,
  ShipyardSearchSource,
  StationStockSource,
  StockItem,
  SystemPopulationFilter,
  SystemSearchSource,
  TradeOpportunityRequest
} from '../domain/station-market.js'
import type { FactionPresenceQuery, StationQuery, TradeMarketQuery } from './mcp-tools/tool-gateways.js'
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
const TRADE_OPPORTUNITY_CACHE_MS = 5 * 60 * 1000
const TRADE_CANDIDATE_LIMIT = 12
const NEARBY_SYSTEM_CACHE_MS = 30 * 60 * 1000
const NEAREST_CACHE_MS = 30 * 60 * 1000
const STOCK_CACHE_MS = 6 * 60 * 60 * 1000
const SHIPYARD_SEARCH_CACHE_MS = 30 * 60 * 1000
const OUTFITTING_SEARCH_CACHE_MS = 30 * 60 * 1000
const STATION_LOOKUP_CACHE_MS = 30 * 60 * 1000
const FILTERED_SYSTEM_CACHE_MS = 30 * 60 * 1000
const FACTION_PRESENCE_CACHE_MS = 30 * 60 * 1000
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

interface TradeOpportunitySearchResult {
  candidateCommoditiesChecked: number
  exportCommoditiesFound: number
  opportunities: GalaxyTradeOpportunity[]
}

export class DefaultStationMarketQuery implements FactionPresenceQuery, StationQuery, TradeMarketQuery {
  private readonly inFlight = new Map<string, Promise<unknown>>()

  public constructor (
    private readonly searchSource: StationSearchSource,
    private readonly stockSource: StationStockSource,
    private readonly shipyardSearchSource: ShipyardSearchSource,
    private readonly outfittingSearchSource: OutfittingSearchSource,
    private readonly stationLookupSource: StationLookupSource,
    private readonly systemSearchSource: SystemSearchSource,
    private readonly factionPresenceSource: FactionPresenceSearchSource,
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

  public async findTradeOpportunities (arguments_: JsonObject) {
    const systemName = this.originSystem(optionalStringArgument(arguments_, 'systemName'))
    const result = await this.searchTradeOpportunities({
      availableCredits: bounded(optionalIntegerArgument(arguments_, 'availableCredits'), 10_000_000, 1, Number.MAX_SAFE_INTEGER),
      cargoCapacity: bounded(optionalIntegerArgument(arguments_, 'cargoCapacity'), 100, 1, 10_000),
      includeFleetCarriers: optionalBooleanArgument(arguments_, 'includeFleetCarriers') ?? false,
      maxDaysAgo: bounded(optionalIntegerArgument(arguments_, 'maxDaysAgo'), 3, 1, 365),
      maxDistance: bounded(optionalIntegerArgument(arguments_, 'maxDistance'), 100, 1, 500),
      minVolume: bounded(optionalIntegerArgument(arguments_, 'minVolume'), 100, 1, Number.MAX_SAFE_INTEGER),
      systemName
    }, boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 5, 20))
    return output(
      result.opportunities.length > 0
        ? [`Reported trade opportunities buying in ${systemName}:`, ...result.opportunities.map(formatTradeOpportunity), result.caveat].join('\n')
        : `No profitable reported trade opportunities were found buying in ${systemName}. ${result.caveat}`,
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

  public async findOutfitting (arguments_: JsonObject) {
    const query = stringArgument(arguments_, 'query')
    const systemName = this.originSystem(optionalStringArgument(arguments_, 'systemName'))
    const minimumPadSize = optionalStringArgument(arguments_, 'minimumPadSize')
    if (minimumPadSize && PAD_SIZES[minimumPadSize] === undefined) {
      throw new Error('minimumPadSize must be small, medium, or large.')
    }
    const result = await this.searchOutfittingMarkets({
      maxDaysAgo: bounded(optionalIntegerArgument(arguments_, 'maxDaysAgo'), 30, 1, 365),
      maxDistanceLy: bounded(optionalIntegerArgument(arguments_, 'maxDistance'), 100, 1, 500),
      minimumPadSize: minimumPadSize ? PAD_SIZES[minimumPadSize]! : null,
      query,
      systemName
    }, boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 5, 20))
    return output(
      result.matches.length > 0
        ? [`Nearest reported outfitting stock for ${formatModuleSpec(result)} from ${result.originSystem}:`, ...result.matches.map(match => (
            `- ${formatModuleSpec(match)} at ${match.stationName} (${match.systemName}) - ${formatDistance(match.distanceLy, 'ly')}, ${formatDistance(match.distanceToArrivalLs, 'ls')}; ${match.price === null ? 'price unknown' : `${formatNumber(match.price)} CR`}; ${match.maxLandingPadSize ? `${padLabel(match.maxLandingPadSize)} pad` : 'pad unknown'}`
          ))].join('\n')
        : `No nearby stations currently report ${formatModuleSpec(result)} in stock.`,
      json(result)
    )
  }

  public async lookup (arguments_: JsonObject) {
    const name = stringArgument(arguments_, 'name')
    const systemName = this.originSystem(optionalStringArgument(arguments_, 'systemName'))
    const minimumPadSize = optionalStringArgument(arguments_, 'minimumPadSize')
    if (minimumPadSize && PAD_SIZES[minimumPadSize] === undefined) {
      throw new Error('minimumPadSize must be small, medium, or large.')
    }
    const stationType = stationLocationType(optionalStringArgument(arguments_, 'stationType'))
    const result = await this.searchStations({
      maxDistanceLy: bounded(optionalIntegerArgument(arguments_, 'maxDistance'), 100, 1, 500),
      minimumPadSize: minimumPadSize ? PAD_SIZES[minimumPadSize]! : null,
      name,
      stationType,
      systemName
    }, boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 5, 20), minimumPadSize === undefined ? null : minimumPadSize as 'small' | 'medium' | 'large')
    return output(
      result.matches.length > 0
        ? [`Stations matching "${name}" near ${result.originSystem}:`, ...result.matches.map(formatStationLookup)].join('\n')
        : `No stations matching "${name}" were reported within ${result.maxDistanceLy} ly of ${result.originSystem}.`,
      json(result)
    )
  }

  public async searchSystems (arguments_: JsonObject) {
    const systemName = this.originSystem(optionalStringArgument(arguments_, 'systemName'))
    const result = await this.searchFilteredSystems({
      allegiance: optionalFilter(arguments_, 'allegiance'),
      economy: optionalFilter(arguments_, 'economy'),
      government: optionalFilter(arguments_, 'government'),
      maxDistanceLy: bounded(optionalIntegerArgument(arguments_, 'maxDistance'), 100, 1, 500),
      maxPopulation: optionalNonnegativeInteger(arguments_, 'maxPopulation'),
      minPopulation: optionalNonnegativeInteger(arguments_, 'minPopulation'),
      population: populationFilter(optionalStringArgument(arguments_, 'population')),
      security: optionalFilter(arguments_, 'security'),
      systemName
    }, boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 10, 20))
    return output(
      result.systems.length > 0
        ? [`Systems matching the requested characteristics near ${result.originSystem}:`, ...result.systems.map(formatFilteredSystem)].join('\n')
        : `No reported systems matched the requested characteristics within ${result.filters.maxDistanceLy} ly of ${result.originSystem}.`,
      json(result)
    )
  }

  public async searchFactionPresences (arguments_: JsonObject) {
    const systemName = this.originSystem(optionalStringArgument(arguments_, 'systemName'))
    const factionName = stringArgument(arguments_, 'factionName')
    const result = await this.findFactionPresences({
      allegiance: optionalFilter(arguments_, 'allegiance'),
      controlling: controllingFilter(optionalStringArgument(arguments_, 'controlling')),
      factionName,
      government: optionalFilter(arguments_, 'government'),
      maxDistanceLy: bounded(optionalIntegerArgument(arguments_, 'maxDistance'), 100, 1, 500),
      minInfluencePercent: bounded(optionalIntegerArgument(arguments_, 'minInfluencePercent'), 0, 0, 100),
      state: optionalFilter(arguments_, 'state'),
      systemName
    }, boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 10, 20))
    return output(
      result.presences.length > 0
        ? [`Community-reported presence for ${factionName} near ${result.originSystem}:`, ...result.presences.map(formatFactionPresence)].join('\n')
        : `No community-reported presence for ${factionName} matched within ${result.filters.maxDistanceLy} ly of ${result.originSystem}.`,
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

  public async searchTradeOpportunities (
    request: TradeOpportunityRequest,
    limit = 20
  ): Promise<GalaxyTradeOpportunitiesResponse> {
    const cached = await this.cached(
      'ardent-trade-opportunities',
      stableKey(request),
      TRADE_OPPORTUNITY_CACHE_MS,
      async () => {
        const [exports, reports] = await Promise.all([
          this.searchSource.findSystemExports(request),
          this.searchSource.getCommodityReports()
        ])
        const maxSellPrices = new Map(reports.map(report => [normalizeName(report.commodityName), report.maxSellPrice]))
        const bestExports = bestExportByCommodity(exports, maxSellPrices, request)
        const candidates = [...bestExports.values()]
          .map(market => ({ market, upperBound: opportunityUpperBound(market, maxSellPrices.get(normalizeName(market.commodityName)) ?? null, request) }))
          .filter(candidate => candidate.upperBound > 0)
          .sort((left, right) => right.upperBound - left.upperBound)
          .slice(0, TRADE_CANDIDATE_LIMIT)
        const resolved = await Promise.all(candidates.map(async candidate => {
          const destinations = await this.searchSource.findCommodityMarkets({
            commodity: candidate.market.commodityName,
            includeFleetCarriers: request.includeFleetCarriers,
            intent: 'sell',
            maxDaysAgo: request.maxDaysAgo,
            maxDistance: request.maxDistance,
            minVolume: request.minVolume,
            systemName: request.systemName
          })
          return bestOpportunity(candidate.market, destinations, request)
        }))
        return {
          candidateCommoditiesChecked: candidates.length,
          exportCommoditiesFound: bestExports.size,
          opportunities: resolved.filter((value): value is GalaxyTradeOpportunity => value !== null)
            .sort((left, right) => right.projectedProfit - left.projectedProfit)
        }
      },
      isTradeOpportunitySearchResult
    )
    return {
      cache: cached.cache,
      candidateCommoditiesChecked: cached.value.candidateCommoditiesChecked,
      caveat: `Best-effort comparison of ${cached.value.candidateCommoditiesChecked} promising exports from ${request.systemName}; community market reports can be stale and other commodities may be more profitable.`,
      exportCommoditiesFound: cached.value.exportCommoditiesFound,
      opportunities: cached.value.opportunities.slice(0, boundedLimit(limit, 20, 100)),
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

  public async searchFilteredSystems (
    input: Omit<FilteredSystemRequest, 'referencePosition'> & { systemName: string },
    limit = 20
  ): Promise<GalaxyFilteredSystemsResponse> {
    if (input.minPopulation !== null && input.maxPopulation !== null && input.minPopulation > input.maxPopulation) {
      throw new Error('minPopulation must not exceed maxPopulation.')
    }
    if (input.population === 'uninhabited' && input.minPopulation !== null && input.minPopulation > 0) {
      throw new Error('Uninhabited systems cannot have a positive minimum population.')
    }
    if (input.population === 'inhabited' && input.maxPopulation === 0) {
      throw new Error('Inhabited systems cannot have a maximum population of zero.')
    }
    const origin = await this.cartography.getSystem(input.systemName)
    if (!origin.system.position) throw new Error(`Coordinates for ${input.systemName} are unavailable.`)
    const { systemName: _systemName, ...filters } = input
    const request: FilteredSystemRequest = { ...filters, referencePosition: origin.system.position }
    const cached = await this.cached(
      'spansh-filtered-systems',
      stableKey({ ...request, systemName: origin.system.name }),
      FILTERED_SYSTEM_CACHE_MS,
      () => this.systemSearchSource.findSystems(request),
      isFilteredSystemResults
    )
    return {
      cache: cached.cache,
      filters,
      originSystem: origin.system.name,
      systems: cached.value.slice(0, boundedLimit(limit, 20, 100))
    }
  }

  public async findFactionPresences (
    input: Omit<FactionPresenceRequest, 'referencePosition'> & { systemName: string },
    limit = 20
  ): Promise<GalaxyFactionPresencesResponse> {
    const origin = await this.cartography.getSystem(input.systemName)
    if (!origin.system.position) throw new Error(`Coordinates for ${input.systemName} are unavailable.`)
    const { systemName: _systemName, ...filters } = input
    const request: FactionPresenceRequest = { ...filters, referencePosition: origin.system.position }
    const cached = await this.cached(
      'spansh-faction-presence',
      stableKey({ ...request, systemName: origin.system.name }),
      FACTION_PRESENCE_CACHE_MS,
      () => this.factionPresenceSource.findFactionPresences(request),
      isFactionPresenceResults
    )
    return {
      cache: cached.cache,
      filters,
      originSystem: origin.system.name,
      presences: cached.value.slice(0, boundedLimit(limit, 20, 100)),
      provenance: 'Spansh community-reported system data'
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

  public async searchOutfittingMarkets (
    input: {
      maxDaysAgo: number
      maxDistanceLy: number
      minimumPadSize: number | null
      query: string
      systemName: string
    },
    limit = 20
  ): Promise<GalaxyOutfittingResponse> {
    const origin = await this.cartography.getSystem(input.systemName)
    if (!origin.system.position) throw new Error(`Coordinates for ${input.systemName} are unavailable.`)
    const module = parseModuleQuery(input.query)
    const request = {
      ...module,
      maxDistanceLy: input.maxDistanceLy,
      minimumPadSize: input.minimumPadSize,
      referencePosition: origin.system.position
    }
    const cached = await this.cached(
      'spansh-outfitting',
      stableKey({ ...request, systemName: origin.system.name }),
      OUTFITTING_SEARCH_CACHE_MS,
      () => this.outfittingSearchSource.findOutfitting(request),
      isOutfittingSearchResults
    )
    const newestAllowed = this.now().getTime() - input.maxDaysAgo * 24 * 60 * 60 * 1000
    const matches = cached.value
      .filter(match => match.updatedAt !== null && Date.parse(match.updatedAt) >= newestAllowed)
      .slice(0, boundedLimit(limit, 20, 100))
    return {
      cache: cached.cache,
      matches,
      ...module,
      originSystem: origin.system.name
    }
  }

  public async searchStations (
    input: {
      maxDistanceLy: number
      minimumPadSize: number | null
      name: string
      stationType: StationLocationType
      systemName: string
    },
    limit = 20,
    minimumPadSize: 'small' | 'medium' | 'large' | null = null
  ): Promise<GalaxyStationLookupResponse> {
    const origin = await this.cartography.getSystem(input.systemName)
    if (!origin.system.position) throw new Error(`Coordinates for ${input.systemName} are unavailable.`)
    const request = {
      maxDistanceLy: input.maxDistanceLy,
      minimumPadSize: input.minimumPadSize,
      name: input.name.trim(),
      referencePosition: origin.system.position,
      stationType: input.stationType
    }
    const cached = await this.cached(
      'spansh-stations',
      stableKey({ ...request, systemName: origin.system.name }),
      STATION_LOOKUP_CACHE_MS,
      () => this.stationLookupSource.findStations(request),
      isStationLookupResults
    )
    return {
      cache: cached.cache,
      matches: cached.value.slice(0, boundedLimit(limit, 20, 100)),
      maxDistanceLy: input.maxDistanceLy,
      minimumPadSize,
      name: request.name,
      originSystem: origin.system.name,
      stationType: input.stationType
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

function formatStationLookup (station: StationLookupResult): string {
  const details = [
    station.stationType,
    station.maxLandingPadSize ? `${padLabel(station.maxLandingPadSize)} pad` : null,
    station.services.length > 0 ? `services: ${station.services.join(', ')}` : null
  ].filter(Boolean).join('; ')
  return `- ${station.stationName} (${station.systemName}) - ${formatDistance(station.distanceLy, 'ly')}, ${formatDistance(station.distanceToArrivalLs, 'ls')}${details ? `; ${details}` : ''}`
}

function formatFilteredSystem (system: FilteredSystemResult): string {
  const details = [
    system.inhabited ? `population ${formatNumber(system.population)}` : 'uninhabited',
    system.economy,
    system.allegiance,
    system.security ? `${system.security} security` : null,
    system.primaryStarClass ? `primary star: ${system.primaryStarClass}` : null
  ].filter(Boolean).join('; ')
  return `- ${system.systemName} - ${formatDistance(system.distanceLy, 'ly')}${details ? `; ${details}` : ''}`
}

function formatFactionPresence (presence: FactionPresenceResult): string {
  const details = [
    `${formatNumber(presence.influencePercent)}% influence`,
    presence.controlling ? 'controlling faction' : null,
    presence.state && presence.state !== 'None' ? `state: ${presence.state}` : null,
    presence.activeStates.length > 0 ? `active: ${presence.activeStates.join(', ')}` : null,
    presence.pendingStates.length > 0 ? `pending: ${presence.pendingStates.join(', ')}` : null,
    presence.recoveringStates.length > 0 ? `recovering: ${presence.recoveringStates.join(', ')}` : null,
    presence.updatedAt ? `system report ${presence.updatedAt}` : 'report time unknown'
  ].filter(Boolean).join('; ')
  return `- ${presence.systemName} - ${formatDistance(presence.distanceLy, 'ly')}; ${details}`
}

function formatMarket (market: CommodityMarket, intent: 'buy' | 'sell'): string {
  const price = intent === 'sell' ? market.sellPrice : market.buyPrice
  const volume = intent === 'sell' ? market.demand : market.stock
  const average = averageComparison(price, market.meanPrice)
  return `- ${market.stationName} (${market.systemName}) - ${formatDistance(market.distanceLy, 'ly')}, ${formatDistance(market.distanceToArrivalLs, 'ls')}; ${intent === 'sell' ? 'station pays' : 'purchase price'}: ${formatNumber(price)} CR${average}; ${intent === 'sell' ? 'demand' : 'supply'}: ${formatNumber(volume)} t`
}

function formatTradeOpportunity (opportunity: GalaxyTradeOpportunity): string {
  return `- ${opportunity.commodityName}: buy ${formatNumber(opportunity.units)} t at ${opportunity.buyMarket.stationName}, sell at ${opportunity.sellMarket.stationName} (${opportunity.sellMarket.systemName}); ${formatNumber(opportunity.unitMargin)} CR/t, projected ${formatNumber(opportunity.projectedProfit)} CR; ${formatDistance(opportunity.travelDistanceLy, 'ly')}`
}

function bestExportByCommodity (
  exports: CommodityMarket[],
  maxSellPrices: Map<string, number | null>,
  request: TradeOpportunityRequest
): Map<string, CommodityMarket> {
  const best = new Map<string, CommodityMarket>()
  for (const market of exports) {
    if (!validExport(market, request)) continue
    const key = normalizeName(market.commodityName)
    const current = best.get(key)
    const maxSellPrice = maxSellPrices.get(key) ?? null
    if (!current || opportunityUpperBound(market, maxSellPrice, request) > opportunityUpperBound(current, maxSellPrice, request)) {
      best.set(key, market)
    }
  }
  return best
}

function opportunityUpperBound (market: CommodityMarket, maxSellPrice: number | null, request: TradeOpportunityRequest): number {
  if (market.buyPrice === null || market.buyPrice <= 0 || maxSellPrice === null) return 0
  const units = purchasableUnits(market.buyPrice, market.stock, null, request)
  return Math.max(0, maxSellPrice - market.buyPrice) * units
}

function bestOpportunity (
  buyMarket: CommodityMarket,
  destinations: CommodityMarket[],
  request: TradeOpportunityRequest
): GalaxyTradeOpportunity | null {
  if (buyMarket.buyPrice === null || buyMarket.buyPrice <= 0) return null
  const buyPrice = buyMarket.buyPrice
  const opportunities = destinations.flatMap(sellMarket => {
    if (
      sellMarket.sellPrice === null || sellMarket.sellPrice <= buyPrice ||
      sellMarket.demand === null || sellMarket.demand < request.minVolume
    ) return []
    const units = purchasableUnits(buyPrice, buyMarket.stock, sellMarket.demand, request)
    if (units <= 0) return []
    const unitMargin = sellMarket.sellPrice - buyPrice
    return [{
      buyMarket,
      commodityName: buyMarket.commodityName,
      projectedProfit: unitMargin * units,
      sellMarket,
      travelDistanceLy: sellMarket.distanceLy,
      unitMargin,
      units
    }]
  })
  return opportunities.sort((left, right) => right.projectedProfit - left.projectedProfit)[0] ?? null
}

function validExport (market: CommodityMarket, request: TradeOpportunityRequest): boolean {
  return market.buyPrice !== null && market.buyPrice > 0 && market.stock !== null && market.stock >= request.minVolume
}

function purchasableUnits (
  buyPrice: number,
  stock: number | null,
  demand: number | null,
  request: TradeOpportunityRequest
): number {
  if (stock === null || stock < request.minVolume || (demand !== null && demand < request.minVolume)) return 0
  return Math.max(0, Math.floor(Math.min(
    request.cargoCapacity,
    stock,
    demand ?? Number.MAX_SAFE_INTEGER,
    Math.floor(request.availableCredits / buyPrice)
  )))
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

function normalizeName (value: string): string {
  return value.trim().toLocaleLowerCase()
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

function isTradeOpportunitySearchResult (candidate: unknown): candidate is TradeOpportunitySearchResult {
  return isRecord(candidate) &&
    typeof candidate.candidateCommoditiesChecked === 'number' &&
    typeof candidate.exportCommoditiesFound === 'number' &&
    Array.isArray(candidate.opportunities) &&
    candidate.opportunities.every(item => (
      isRecord(item) &&
      typeof item.commodityName === 'string' &&
      typeof item.projectedProfit === 'number' &&
      isRecord(item.buyMarket) &&
      isRecord(item.sellMarket)
    ))
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

function isOutfittingSearchResults (candidate: unknown): candidate is OutfittingSearchResult[] {
  return Array.isArray(candidate) && candidate.every(item => (
    isRecord(item) &&
    typeof item.moduleName === 'string' &&
    typeof item.stationName === 'string' &&
    typeof item.systemName === 'string' &&
    typeof item.distanceLy === 'number'
  ))
}

function isStationLookupResults (candidate: unknown): candidate is StationLookupResult[] {
  return Array.isArray(candidate) && candidate.every(item => (
    isRecord(item) &&
    typeof item.stationName === 'string' &&
    typeof item.systemName === 'string' &&
    typeof item.distanceLy === 'number' &&
    Array.isArray(item.services)
  ))
}

function isFilteredSystemResults (candidate: unknown): candidate is FilteredSystemResult[] {
  return Array.isArray(candidate) && candidate.every(item => (
    isRecord(item) &&
    typeof item.systemName === 'string' &&
    typeof item.distanceLy === 'number' &&
    typeof item.population === 'number' &&
    Array.isArray(item.position) && item.position.length === 3
  ))
}

function isFactionPresenceResults (candidate: unknown): candidate is FactionPresenceResult[] {
  return Array.isArray(candidate) && candidate.every(item => (
    isRecord(item) &&
    typeof item.factionName === 'string' &&
    typeof item.systemName === 'string' &&
    typeof item.distanceLy === 'number' &&
    typeof item.influencePercent === 'number' &&
    typeof item.controlling === 'boolean' &&
    Array.isArray(item.position) && item.position.length === 3
  ))
}

function populationFilter (candidate?: string): SystemPopulationFilter {
  if (candidate === undefined || candidate === 'any') return 'any'
  if (candidate === 'inhabited' || candidate === 'uninhabited') return candidate
  throw new Error('population must be any, inhabited, or uninhabited.')
}

function controllingFilter (candidate?: string): FactionControllingFilter {
  if (candidate === undefined || candidate === 'any') return 'any'
  if (candidate === 'yes' || candidate === 'no') return candidate
  throw new Error('controlling must be any, yes, or no.')
}

function optionalFilter (arguments_: JsonObject, name: string): string | null {
  const value = optionalStringArgument(arguments_, name)
  return !value || value === 'any' ? null : value
}

function optionalNonnegativeInteger (arguments_: JsonObject, name: string): number | null {
  const value = optionalIntegerArgument(arguments_, name)
  if (value === undefined) return null
  if (value < 0) throw new Error(`${name} must be zero or greater.`)
  return value
}

function stationLocationType (candidate?: string): StationLocationType {
  if (candidate === undefined) return 'any'
  if (candidate === 'any' || candidate === 'carrier' || candidate === 'orbital' || candidate === 'surface') return candidate
  throw new Error('stationType must be any, orbital, surface, or carrier.')
}

function parseModuleQuery (query: string): { moduleClass: number | null, moduleName: string, moduleRating: string | null } {
  const normalized = query.trim().replace(/\s+/g, ' ')
  const rated = /^(\d)([A-I])\s+(.+)$/i.exec(normalized)
  if (!rated) return { moduleClass: null, moduleName: normalized, moduleRating: null }
  return {
    moduleClass: Number(rated[1]),
    moduleName: rated[3]!,
    moduleRating: rated[2]!.toUpperCase()
  }
}

function formatModuleSpec (module: { moduleClass: number | null, moduleName: string, moduleRating: string | null }): string {
  return `${module.moduleClass ?? ''}${module.moduleRating ?? ''}${module.moduleClass !== null || module.moduleRating !== null ? ' ' : ''}${module.moduleName}`
}

function isRecord (candidate: unknown): candidate is Record<string, unknown> {
  return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
}
