import type {
  GalaxyCommodityMarketsResponse,
  GalaxyFactionPresencesResponse,
  GalaxyFilteredSystemsResponse,
  GalaxyNearbySystemsResponse,
  GalaxyNearestStationsResponse,
  GalaxyOutfittingResponse,
  GalaxyStationLookupResponse,
  GalaxyShipyardsResponse
} from '@phoenix/contracts'
import type { CommodityMarketRequest, FactionPresenceRequest, FilteredSystemRequest, NearbySystemRequest, NearestStationRequest, StationLocationType } from '../domain/station-market.js'

export interface GalaxyDataReader {
  searchCommodityMarkets(request: CommodityMarketRequest, limit?: number): Promise<GalaxyCommodityMarketsResponse>
  searchFilteredSystems(request: Omit<FilteredSystemRequest, 'referencePosition'> & { systemName: string }, limit?: number): Promise<GalaxyFilteredSystemsResponse>
  findFactionPresences(request: Omit<FactionPresenceRequest, 'referencePosition'> & { systemName: string }, limit?: number): Promise<GalaxyFactionPresencesResponse>
  searchNearbySystems(request: NearbySystemRequest, limit?: number): Promise<GalaxyNearbySystemsResponse>
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
