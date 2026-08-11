export interface NearbyStation {
  allegiance: string | null
  controllingFaction: string | null
  distanceLy: number | null
  distanceToArrivalLs: number | null
  government: string | null
  marketId: number | null
  maxLandingPadSize: number | null
  primaryEconomy: string | null
  secondaryEconomy: string | null
  stationName: string
  stationType: string | null
  systemName: string
  updatedAt: string | null
}

export interface CommodityMarket {
  buyPrice: number | null
  commodityName: string
  demand: number | null
  distanceLy: number | null
  distanceToArrivalLs: number | null
  marketId: number | null
  maxLandingPadSize: number | null
  meanPrice: number | null
  sellPrice: number | null
  stationName: string
  stationType: string | null
  stock: number | null
  systemName: string
  updatedAt: string | null
}

export interface NearestStationRequest {
  minimumPadSize: number | null
  service: string
  systemName: string
}

export interface CommodityMarketRequest {
  commodity: string
  includeFleetCarriers: boolean
  intent: 'buy' | 'sell'
  maxDaysAgo: number
  maxDistance: number
  minVolume: number
  systemName: string
}

export interface StationSearchSource {
  findCommodityMarkets(request: CommodityMarketRequest): Promise<CommodityMarket[]>
  findNearestStations(request: NearestStationRequest): Promise<NearbyStation[]>
}

export interface StockItem {
  id: number | string | null
  name: string
}

export interface StationStockSource {
  getOutfitting(marketId: number): Promise<StockItem[]>
  getShipyard(marketId: number): Promise<StockItem[]>
}

export interface ProviderCacheEntry {
  fetchedAt: string
  value: unknown
}

export interface ProviderResponseCache {
  getProviderResponse(namespace: string, key: string): ProviderCacheEntry | null
  putProviderResponse(namespace: string, key: string, fetchedAt: string, value: unknown): void
}
