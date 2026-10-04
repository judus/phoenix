import { AiError, ToolUsageError, type JsonObject } from '@jdu/llm-client'
import { MATERIAL_TRADER_SERVICES, NEAREST_STATION_SERVICES } from '@phoenix/contracts'
import type { MaterialTraderSearchSource, StationServiceSearchSource } from '../domain/station-market.js'
import { StationReferenceResolver } from './station-reference-resolver.js'
import type {
  CartographicStation,
  GalaxyCommodityMarketsResponse,
  GalaxyFactionPresencesResponse,
  GalaxySystemSearchResponse,
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
  SystemSearchRequest,
  SystemSearchResult,
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
import { DEFAULT_GALAXY_RESULT_LIMIT } from './galaxy-data-service.js'
import { ProviderQueryCache } from './provider-query-cache.js'
import {
  boundedLimit,
  json,
  optionalBooleanArgument,
  optionalIntegerArgument,
  optionalStringArgument,
  output,
  stringArgument,
  ToolArgumentError
} from './mcp-tools/tool-support.js'

const MARKET_CACHE_MS = 5 * 60 * 1000
const TRADE_OPPORTUNITY_CACHE_MS = 5 * 60 * 1000
const TRADE_CANDIDATE_LIMIT = 12
const NEAREST_CACHE_MS = 30 * 60 * 1000
const STOCK_CACHE_MS = 6 * 60 * 60 * 1000
const SHIPYARD_SEARCH_CACHE_MS = 30 * 60 * 1000
const OUTFITTING_SEARCH_CACHE_MS = 30 * 60 * 1000
const STATION_LOOKUP_CACHE_MS = 30 * 60 * 1000
const FILTERED_SYSTEM_CACHE_MS = 30 * 60 * 1000
const FACTION_PRESENCE_CACHE_MS = 30 * 60 * 1000
const PAD_SIZES: Record<string, number> = { small: 1, medium: 2, large: 3 }

interface TradeOpportunitySearchResult {
  candidateCommoditiesChecked: number
  exportCommoditiesFound: number
  opportunities: GalaxyTradeOpportunity[]
}

export class DefaultStationMarketQuery implements FactionPresenceQuery, StationQuery, TradeMarketQuery {
  private readonly providerQueries: ProviderQueryCache
  private readonly stationReferences: StationReferenceResolver

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
    cache: ProviderResponseCache,
    private readonly now: () => Date = () => new Date(),
    private readonly materialTraderSource?: MaterialTraderSearchSource,
    private readonly stationServiceSource?: StationServiceSearchSource
  ) {
    this.providerQueries = new ProviderQueryCache(cache, now)
    this.stationReferences = new StationReferenceResolver(cartography, runtimeState)
  }

  public async findBestTrade (arguments_: JsonObject) {
    const commodity = stringArgument(arguments_, 'commodity')
    const intent = stringArgument(arguments_, 'intent')
    if (intent !== 'buy' && intent !== 'sell') {
      throw new ToolArgumentError('intent must be buy or sell from the commander perspective.', 'Set intent to buy when purchasing cargo, or sell when selling cargo.')
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
      throw new ToolArgumentError('minimumPadSize must be small, medium, or large.', 'Choose small, medium, or large for minimumPadSize, or omit it.')
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
      throw new ToolArgumentError('minimumPadSize must be small, medium, or large.', 'Choose small, medium, or large for minimumPadSize, or omit it.')
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
    const systemName = optionalStringArgument(arguments_, 'systemName')
    const minimumPadSize = optionalStringArgument(arguments_, 'minimumPadSize')
    if (minimumPadSize && PAD_SIZES[minimumPadSize] === undefined) {
      throw new ToolArgumentError('minimumPadSize must be small, medium, or large.', 'Choose small, medium, or large for minimumPadSize, or omit it.')
    }
    const stationType = stationLocationType(optionalStringArgument(arguments_, 'stationType'))
    const result = await this.searchStations({
      maxDistanceLy: arguments_.maxDistance === undefined ? null : bounded(optionalIntegerArgument(arguments_, 'maxDistance'), 100, 1, 500),
      minimumPadSize: minimumPadSize ? PAD_SIZES[minimumPadSize]! : null,
      name,
      stationType,
      systemName
    }, boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 5, 20), minimumPadSize === undefined ? null : minimumPadSize as 'small' | 'medium' | 'large')
    return output(
      result.matches.length > 0
        ? [`Stations matching "${name}"${result.originSystem ? ` (distances from ${result.originSystem})` : ''}:`, ...result.matches.map(formatStationLookup)].join('\n')
        : `No stations matching "${name}" were reported${result.maxDistanceLy === null ? '' : ` within ${result.maxDistanceLy} ly of ${result.originSystem}`}.`,
      json(result)
    )
  }

  public async searchSystems (arguments_: JsonObject) {
    const systemName = this.originSystem(optionalStringArgument(arguments_, 'systemName'))
    const result = await this.findSystems({
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
        ? [`Systems matching the requested characteristics near ${result.originSystem}:`, ...result.systems.map(formatSystemSearchResult)].join('\n')
        : `No reported systems matched the requested characteristics within ${result.filters.maxDistanceLy} ly of ${result.originSystem}.`,
      json(result)
    )
  }

  public async searchFactionPresences (arguments_: JsonObject) {
    const systemName = this.originSystem(optionalStringArgument(arguments_, 'systemName'))
    const factionName = optionalStringArgument(arguments_, 'factionName') ?? null
    const result = await this.findFactionPresences({
      allegiance: optionalFilter(arguments_, 'allegiance'),
      controlling: controllingFilter(optionalStringArgument(arguments_, 'controlling')),
      factionName,
      government: optionalFilter(arguments_, 'government'),
      maxDistanceLy: bounded(optionalIntegerArgument(arguments_, 'maxDistance'), 100, 1, 500),
      minInfluencePercent: bounded(optionalIntegerArgument(arguments_, 'minInfluencePercent'), 0, 0, 100),
      state: optionalFilter(arguments_, 'state'),
      states: Array.isArray(arguments_.states) ? arguments_.states.filter((value): value is string => typeof value === 'string' && value.trim().length > 0) : undefined,
      systemName
    }, boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 10, 20))
    return output(
      result.presences.length > 0
        ? [`Community-reported presence for ${factionName ?? 'matching factions'} near ${result.originSystem}:`, ...result.presences.map(formatFactionPresence)].join('\n')
        : `No community-reported presence for ${factionName ?? 'matching factions'} matched within ${result.filters.maxDistanceLy} ly of ${result.originSystem}.`,
      json(result)
    )
  }

  public async searchCommodityMarkets (
    request: CommodityMarketRequest,
    limit = DEFAULT_GALAXY_RESULT_LIMIT
  ): Promise<GalaxyCommodityMarketsResponse> {
    const cached = await this.providerQueries.get(
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
      markets: cached.value.slice(0, boundedLimit(limit, DEFAULT_GALAXY_RESULT_LIMIT, DEFAULT_GALAXY_RESULT_LIMIT)),
      originSystem: request.systemName
    }
  }

  public async searchTradeOpportunities (
    request: TradeOpportunityRequest,
    limit = DEFAULT_GALAXY_RESULT_LIMIT
  ): Promise<GalaxyTradeOpportunitiesResponse> {
    const cached = await this.providerQueries.get(
      'ardent-trade-opportunities',
      stableKey(request),
      TRADE_OPPORTUNITY_CACHE_MS,
      async () => {
        const [exports, reports] = await Promise.all([
          this.searchSource.findSystemExports(request),
          this.searchSource.getCommodityReports()
        ])
        const maxSellPrices = new Map(reports.map(report => [normalizeName(report.commoditySymbol), report.maxSellPrice]))
        const bestExports = bestExportByCommodity(exports, maxSellPrices, request)
        const candidates = [...bestExports.values()]
          .map(market => ({ market, upperBound: opportunityUpperBound(market, maxSellPrices.get(normalizeName(market.commoditySymbol)) ?? null, request) }))
          .filter(candidate => candidate.upperBound > 0)
          .sort((left, right) => right.upperBound - left.upperBound)
          .slice(0, TRADE_CANDIDATE_LIMIT)
        const resolved = await Promise.all(candidates.map(async candidate => {
          const destinations = await this.searchSource.findCommodityMarkets({
            commodity: candidate.market.commoditySymbol,
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
      opportunities: cached.value.opportunities.slice(0, boundedLimit(limit, DEFAULT_GALAXY_RESULT_LIMIT, DEFAULT_GALAXY_RESULT_LIMIT)),
      originSystem: request.systemName
    }
  }

  public async searchNearestStations (
    request: NearestStationRequest,
    limit = DEFAULT_GALAXY_RESULT_LIMIT,
    minimumPadSize: 'small' | 'medium' | 'large' | null = null
  ): Promise<GalaxyNearestStationsResponse> {
    if (!NEAREST_STATION_SERVICES.includes(request.service)) {
      throw new ToolUsageError('stations.find_nearest_service', 'Unsupported service.', `Choose service from: ${NEAREST_STATION_SERVICES.join(', ')}.`)
    }
    const traderType = MATERIAL_TRADER_SERVICES[request.service as keyof typeof MATERIAL_TRADER_SERVICES]
    let load = () => this.searchSource.findNearestStations(request)
    let key = stableKey(request)
    const stationService = request.service === 'vista-genomics' ? 'Vista Genomics' : null
    if (traderType || stationService) {
      const origin = await this.cartography.getSystem(request.systemName)
      const referencePosition = origin.system.position
      if (!referencePosition) throw new ToolUsageError('stations.find_nearest_service', 'Reference system coordinates are unavailable.', 'Choose a known reference system in systemName.')
      const filters = { minimumPadSize: request.minimumPadSize, referencePosition }
      key = stableKey({ ...request, referencePosition })
      if (traderType) {
        const source = this.materialTraderSource
        if (!source) throw new AiError('provider_unavailable', 'Material trader search is not configured. Ask the user to check the search provider; do not change query arguments.', { code: 'material_trader_not_configured', retryable: false })
        load = () => source.findMaterialTraders({ ...filters, traderType })
      } else if (stationService) {
        const source = this.stationServiceSource
        if (!source) throw new AiError('provider_unavailable', 'Station service search is not configured. Ask the user to check the search provider; do not change query arguments.', { code: 'station_service_not_configured', retryable: false })
        load = () => source.findStationsWithService({ ...filters, service: stationService })
      }
    }
    const cached = await this.providerQueries.get(
      traderType ? 'spansh-material-trader-v2' : stationService ? 'spansh-station-service-v2' : 'ardent-nearest',
      key,
      NEAREST_CACHE_MS,
      load,
      isNearbyStations
    )
    return {
      cache: cached.cache,
      minimumPadSize,
      originSystem: request.systemName,
      service: request.service,
      stations: cached.value.slice(0, boundedLimit(limit, DEFAULT_GALAXY_RESULT_LIMIT, DEFAULT_GALAXY_RESULT_LIMIT))
    }
  }

  public async findSystems (
    input: Omit<SystemSearchRequest, 'referencePosition'> & { systemName: string },
    limit = DEFAULT_GALAXY_RESULT_LIMIT
  ): Promise<GalaxySystemSearchResponse> {
    if (input.minPopulation !== null && input.maxPopulation !== null && input.minPopulation > input.maxPopulation) {
      throw new ToolArgumentError('minPopulation must not exceed maxPopulation.', 'Lower minPopulation or increase maxPopulation so the minimum is no greater than the maximum.')
    }
    if (input.population === 'uninhabited' && input.minPopulation !== null && input.minPopulation > 0) {
      throw new ToolArgumentError('Uninhabited systems cannot have a positive minimum population.', 'Set minPopulation to zero or omit it, or choose population inhabited/any.')
    }
    if (input.population === 'inhabited' && input.maxPopulation === 0) {
      throw new ToolArgumentError('Inhabited systems cannot have a maximum population of zero.', 'Increase maxPopulation above zero or omit it, or choose population uninhabited/any.')
    }
    const origin = await this.cartography.getSystem(input.systemName)
    if (!origin.system.position) throw new ToolArgumentError('Reference system coordinates are unavailable.', 'Choose a known reference system in systemName.')
    const { systemName: _systemName, ...filters } = input
    const request: SystemSearchRequest = { ...filters, referencePosition: origin.system.position }
    const cached = await this.providerQueries.get(
      'spansh-system-search-v2',
      stableKey({ ...request, systemName: origin.system.name }),
      FILTERED_SYSTEM_CACHE_MS,
      () => this.systemSearchSource.findSystems(request),
      isSystemSearchResults
    )
    return {
      cache: cached.cache,
      filters,
      originSystem: origin.system.name,
      systems: cached.value.slice(0, boundedLimit(limit, DEFAULT_GALAXY_RESULT_LIMIT, DEFAULT_GALAXY_RESULT_LIMIT))
    }
  }

  public async findFactionPresences (
    input: Omit<FactionPresenceRequest, 'referencePosition'> & { systemName: string },
    limit = DEFAULT_GALAXY_RESULT_LIMIT
  ): Promise<GalaxyFactionPresencesResponse> {
    const origin = await this.cartography.getSystem(input.systemName)
    if (!origin.system.position) throw new ToolArgumentError('Reference system coordinates are unavailable.', 'Choose a known reference system in systemName.')
    const { systemName: _systemName, ...filters } = input
    const request: FactionPresenceRequest = { ...filters, referencePosition: origin.system.position }
    const cached = await this.providerQueries.get(
      'spansh-faction-presence-v2',
      stableKey({ ...request, systemName: origin.system.name }),
      FACTION_PRESENCE_CACHE_MS,
      () => this.factionPresenceSource.findFactionPresences(request),
      isFactionPresenceResults
    )
    return {
      cache: cached.cache,
      filters,
      originSystem: origin.system.name,
      presences: cached.value.slice(0, boundedLimit(limit, DEFAULT_GALAXY_RESULT_LIMIT, DEFAULT_GALAXY_RESULT_LIMIT)),
      provenance: 'Spansh community-reported system data'
    }
  }

  public async searchShipyards (
    hullName: string,
    systemName: string,
    limit = DEFAULT_GALAXY_RESULT_LIMIT
  ): Promise<GalaxyShipyardsResponse> {
    const origin = await this.cartography.getSystem(systemName)
    if (!origin.system.position) throw new ToolArgumentError('Reference system coordinates are unavailable.', 'Choose a known reference system in systemName.')
    const request = { hullName, referencePosition: origin.system.position }
    const cached = await this.providerQueries.get(
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
      shipyards: cached.value.slice(0, boundedLimit(limit, DEFAULT_GALAXY_RESULT_LIMIT, DEFAULT_GALAXY_RESULT_LIMIT))
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
    limit = DEFAULT_GALAXY_RESULT_LIMIT
  ): Promise<GalaxyOutfittingResponse> {
    const origin = await this.cartography.getSystem(input.systemName)
    if (!origin.system.position) throw new ToolArgumentError('Reference system coordinates are unavailable.', 'Choose a known reference system in systemName.')
    const module = parseModuleQuery(input.query)
    const asOf = this.now()
    const newestAllowed = asOf.getTime() - input.maxDaysAgo * 24 * 60 * 60 * 1000
    const filters = {
      ...module,
      maxDistanceLy: input.maxDistanceLy,
      minimumPadSize: input.minimumPadSize,
      referencePosition: origin.system.position
    }
    const request = {
      ...filters,
      reportedAfter: new Date(newestAllowed).toISOString(),
      reportedBefore: asOf.toISOString()
    }
    const cached = await this.providerQueries.get(
      'spansh-outfitting-v3',
      // Exact timestamps bound the provider search; the age policy identifies the cache entry.
      stableKey({ ...filters, maxDaysAgo: input.maxDaysAgo, systemName: origin.system.name }),
      OUTFITTING_SEARCH_CACHE_MS,
      () => this.outfittingSearchSource.findOutfitting(request),
      isOutfittingSearchResults
    )
    const matches = cached.value
      .filter(match => match.updatedAt !== null && Date.parse(match.updatedAt) >= newestAllowed && Date.parse(match.updatedAt) <= asOf.getTime())
      .slice(0, boundedLimit(limit, DEFAULT_GALAXY_RESULT_LIMIT, DEFAULT_GALAXY_RESULT_LIMIT))
    return {
      cache: cached.cache,
      matches,
      ...module,
      originSystem: origin.system.name
    }
  }

  public async searchStations (
    input: {
      maxDistanceLy?: number | null
      minimumPadSize?: number | null
      name: string
      stationType?: StationLocationType
      systemName?: string
    },
    limit = DEFAULT_GALAXY_RESULT_LIMIT,
    minimumPadSize: 'small' | 'medium' | 'large' | null = null
  ): Promise<GalaxyStationLookupResponse> {
    const origin = input.systemName
      ? await this.cartography.getSystem(input.systemName)
      : { system: this.runtimeState.getCurrent().system }
    const request = {
      maxDistanceLy: input.maxDistanceLy ?? null,
      minimumPadSize: input.minimumPadSize ?? null,
      name: input.name.trim(),
      referencePosition: origin?.system.position ?? null,
      stationType: input.stationType ?? 'any'
    }
    if (request.maxDistanceLy !== null && request.referencePosition === null) throw new ToolUsageError('stations.find_stations_by_name', 'A distance limit needs a reference system with known coordinates.', 'Provide a reference system (systemName), or remove maxDistance for an unrestricted name search.')
    const cached = await this.providerQueries.get(
      'spansh-stations-v3',
      stableKey({ ...request, systemName: origin?.system.name ?? null }),
      STATION_LOOKUP_CACHE_MS,
      () => this.stationLookupSource.findStations(request),
      isStationLookupResults
    )
    return {
      cache: cached.cache,
      matches: cached.value.slice(0, boundedLimit(limit, DEFAULT_GALAXY_RESULT_LIMIT, DEFAULT_GALAXY_RESULT_LIMIT)),
      maxDistanceLy: request.maxDistanceLy,
      minimumPadSize,
      name: request.name,
      originSystem: origin?.system.name ?? null,
      stationType: request.stationType
    }
  }

  public async getDetails (arguments_: JsonObject) {
    const resolved = await this.stationReferences.resolve(arguments_, 'stations.get_station_details')
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
    const resolved = await this.stationReferences.resolve(arguments_, 'stations.list_shipyard_stock')
    if (!resolved.station.facilities.shipyard) {
      return output(`${resolved.station.name} (${resolved.systemName}) does not report a shipyard.`, {
        station: resolved.station.name, systemName: resolved.systemName, ships: []
      })
    }
    const marketId = requiredMarketId(resolved.station)
    const cached = await this.providerQueries.get(
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
    const resolved = await this.stationReferences.resolve(arguments_, 'stations.list_outfitting_stock')
    if (!resolved.station.facilities.outfitting) {
      return output(`${resolved.station.name} (${resolved.systemName}) does not report outfitting.`, {
        modules: [], query, station: resolved.station.name, systemName: resolved.systemName
      })
    }
    const marketId = requiredMarketId(resolved.station)
    const cached = await this.providerQueries.get(
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
    if (!systemName) throw new ToolArgumentError('Current system is unavailable. Provide systemName explicitly.', 'Provide systemName explicitly, or wait until the current system is reported.')
    return systemName
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
  if (station.marketId === null) throw new ToolArgumentError('The selected station has no known market ID for stock lookup.', 'Select a station with a reported market ID; use stations.find_stations_by_name to check the station metadata. Do not retry this stock lookup unchanged.')
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

function formatSystemSearchResult (system: SystemSearchResult): string {
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
    const key = normalizeName(market.commoditySymbol)
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
      commoditySymbol: buyMarket.commoditySymbol,
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

function isCommodityMarkets (candidate: unknown): candidate is CommodityMarket[] {
  return Array.isArray(candidate) && candidate.every(item => isRecord(item) && typeof item.commodityName === 'string' && typeof item.commoditySymbol === 'string' && typeof item.stationName === 'string')
}

function isTradeOpportunitySearchResult (candidate: unknown): candidate is TradeOpportunitySearchResult {
  return isRecord(candidate) &&
    typeof candidate.candidateCommoditiesChecked === 'number' &&
    typeof candidate.exportCommoditiesFound === 'number' &&
    Array.isArray(candidate.opportunities) &&
    candidate.opportunities.every(item => (
      isRecord(item) &&
      typeof item.commodityName === 'string' &&
      typeof item.commoditySymbol === 'string' &&
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
    (item.distanceLy === null || typeof item.distanceLy === 'number') &&
    Array.isArray(item.services)
  ))
}

function isSystemSearchResults (candidate: unknown): candidate is SystemSearchResult[] {
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
  throw new ToolArgumentError('population must be any, inhabited, or uninhabited.', 'Choose any, inhabited, or uninhabited for population, or omit it.')
}

function controllingFilter (candidate?: string): FactionControllingFilter {
  if (candidate === undefined || candidate === 'any') return 'any'
  if (candidate === 'yes' || candidate === 'no') return candidate
  throw new ToolArgumentError('controlling must be any, yes, or no.', 'Choose any, yes, or no for controlling, or omit it.')
}

function optionalFilter (arguments_: JsonObject, name: string): string | null {
  const value = optionalStringArgument(arguments_, name)
  return !value || value === 'any' ? null : value
}

function optionalNonnegativeInteger (arguments_: JsonObject, name: string): number | null {
  const value = optionalIntegerArgument(arguments_, name)
  if (value === undefined) return null
  if (value < 0) throw new ToolArgumentError(`${name} must be zero or greater.`, `Set ${name} to a non-negative integer, or omit it.`)
  return value
}

function stationLocationType (candidate?: string): StationLocationType {
  if (candidate === undefined) return 'any'
  if (candidate === 'any' || candidate === 'carrier' || candidate === 'orbital' || candidate === 'surface') return candidate
  throw new ToolArgumentError('stationType must be any, orbital, surface, or carrier.', 'Choose any, orbital, surface, or carrier for stationType, or omit it.')
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
