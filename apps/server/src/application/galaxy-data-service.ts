import type {
  GalaxyCommodityMarketsResponse,
  GalaxyNearestStationsResponse
} from '@phoenix/contracts'
import type { CommodityMarketRequest, NearestStationRequest } from '../domain/station-market.js'

export interface GalaxyDataReader {
  searchCommodityMarkets(request: CommodityMarketRequest, limit?: number): Promise<GalaxyCommodityMarketsResponse>
  searchNearestStations(
    request: NearestStationRequest,
    limit?: number,
    minimumPadSize?: 'small' | 'medium' | 'large' | null
  ): Promise<GalaxyNearestStationsResponse>
}
