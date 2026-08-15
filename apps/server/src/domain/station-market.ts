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

export interface NearbySystem {
  distanceLy: number
  position: [number, number, number]
  systemAddress: number | null
  systemName: string
  updatedAt: string | null
}

export interface NearbySystemRequest {
  maxDistance: number
  systemName: string
}

export interface ShipyardSearchResult {
  distanceLy: number
  distanceToArrivalLs: number | null
  marketId: number | null
  maxLandingPadSize: number | null
  price: number | null
  shipSymbol: string | null
  stationName: string
  stationType: string | null
  systemName: string
  updatedAt: string | null
}

export interface ShipyardSearchRequest {
  hullName: string
  referencePosition: [number, number, number]
}

export interface OutfittingModuleSpec {
  moduleClass: number | null
  moduleName: string
  moduleRating: string | null
}

export interface OutfittingSearchResult extends OutfittingModuleSpec {
  category: string | null
  distanceLy: number
  distanceToArrivalLs: number | null
  marketId: number | null
  maxLandingPadSize: number | null
  moduleSymbol: string | null
  price: number | null
  ship: string | null
  stationName: string
  stationType: string | null
  systemName: string
  updatedAt: string | null
}

export interface OutfittingSearchRequest extends OutfittingModuleSpec {
  maxDistanceLy: number
  minimumPadSize: number | null
  referencePosition: [number, number, number]
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
  findNearbySystems(request: NearbySystemRequest): Promise<NearbySystem[]>
}

export interface StockItem {
  id: number | string | null
  name: string
}

export interface StationStockSource {
  getOutfitting(marketId: number): Promise<StockItem[]>
  getShipyard(marketId: number): Promise<StockItem[]>
}

export interface ShipyardSearchSource {
  findShipyards(request: ShipyardSearchRequest): Promise<ShipyardSearchResult[]>
}

export interface OutfittingSearchSource {
  findOutfitting(request: OutfittingSearchRequest): Promise<OutfittingSearchResult[]>
}

export interface ProviderCacheEntry {
  fetchedAt: string
  value: unknown
}

export interface ProviderResponseCache {
  getProviderResponse(namespace: string, key: string): ProviderCacheEntry | null
  putProviderResponse(namespace: string, key: string, fetchedAt: string, value: unknown): void
}
