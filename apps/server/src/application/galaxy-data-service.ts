import type {
  GalaxyCommodityMarketsResponse,
  GalaxyNearbySystemsResponse,
  GalaxyNearestStationsResponse
} from '@phoenix/contracts'
import type { CommodityMarketRequest, NearbySystemRequest, NearestStationRequest } from '../domain/station-market.js'

export interface GalaxyDataReader {
  searchCommodityMarkets(request: CommodityMarketRequest, limit?: number): Promise<GalaxyCommodityMarketsResponse>
  searchNearbySystems(request: NearbySystemRequest, limit?: number): Promise<GalaxyNearbySystemsResponse>
  searchNearestStations(
    request: NearestStationRequest,
    limit?: number,
    minimumPadSize?: 'small' | 'medium' | 'large' | null
  ): Promise<GalaxyNearestStationsResponse>
}
