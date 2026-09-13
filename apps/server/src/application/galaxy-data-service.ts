import type {
  GalaxyCommodityMarketsResponse,
  GalaxyFactionPresencesResponse,
  GalaxySystemSearchResponse,
  GalaxyNearestStationsResponse,
  GalaxyOutfittingResponse,
  GalaxyStationLookupResponse,
  GalaxyShipyardsResponse,
  GalaxyTradeOpportunitiesResponse
} from '@phoenix/contracts'
import type { CommodityMarketRequest, FactionPresenceRequest, NearestStationRequest, StationLocationType, SystemSearchRequest, TradeOpportunityRequest } from '../domain/station-market.js'

export const DEFAULT_GALAXY_RESULT_LIMIT = 100

export interface GalaxyDataReader {
  searchCommodityMarkets(request: CommodityMarketRequest, limit?: number): Promise<GalaxyCommodityMarketsResponse>
  searchTradeOpportunities(request: TradeOpportunityRequest, limit?: number): Promise<GalaxyTradeOpportunitiesResponse>
  findSystems(request: Omit<SystemSearchRequest, 'referencePosition'> & { systemName: string }, limit?: number): Promise<GalaxySystemSearchResponse>
  findFactionPresences(request: Omit<FactionPresenceRequest, 'referencePosition'> & { systemName: string }, limit?: number): Promise<GalaxyFactionPresencesResponse>
  searchOutfittingMarkets(input: {
    maxDaysAgo: number
    maxDistanceLy: number
    minimumPadSize: number | null
    query: string
    systemName: string
  }, limit?: number): Promise<GalaxyOutfittingResponse>
  searchShipyards(hullName: string, systemName: string, limit?: number): Promise<GalaxyShipyardsResponse>
  searchStations(input: {
    maxDistanceLy: number
    minimumPadSize: number | null
    name: string
    stationType: StationLocationType
    systemName: string
  }, limit?: number, minimumPadSize?: 'small' | 'medium' | 'large' | null): Promise<GalaxyStationLookupResponse>
  searchNearestStations(
    request: NearestStationRequest,
    limit?: number,
    minimumPadSize?: 'small' | 'medium' | 'large' | null
  ): Promise<GalaxyNearestStationsResponse>
}
