import { z } from 'zod'

const nullableNumber = z.number().finite().nonnegative().nullable()
const nullableString = z.string().min(1).nullable()

export const GalaxyCacheStateSchema = z.enum(['fresh', 'refreshed', 'stale'])

export const GalaxyNearbySystemSchema = z.object({
  distanceLy: z.number().finite().nonnegative(),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
  systemAddress: z.number().int().nonnegative().nullable(),
  systemName: z.string().min(1),
  updatedAt: z.string().datetime().nullable()
})

export const GalaxyNearbySystemsResponseSchema = z.object({
  cache: GalaxyCacheStateSchema,
  maxDistanceLy: z.number().int().min(1).max(500),
  originSystem: z.string().min(1),
  systems: z.array(GalaxyNearbySystemSchema)
})

export const GalaxyShipyardSchema = z.object({
  distanceLy: z.number().finite().nonnegative(),
  distanceToArrivalLs: nullableNumber,
  marketId: z.number().int().nonnegative().nullable(),
  maxLandingPadSize: z.number().int().min(1).max(3).nullable(),
  price: nullableNumber,
  shipSymbol: nullableString,
  stationName: z.string().min(1),
  stationType: nullableString,
  systemName: z.string().min(1),
  updatedAt: z.string().datetime().nullable()
})

export const GalaxyShipyardsResponseSchema = z.object({
  cache: GalaxyCacheStateSchema,
  hullName: z.string().min(1),
  originSystem: z.string().min(1),
  shipyards: z.array(GalaxyShipyardSchema)
})

export const GalaxyOutfittingMatchSchema = z.object({
  category: nullableString,
  distanceLy: z.number().finite().nonnegative(),
  distanceToArrivalLs: nullableNumber,
  marketId: z.number().int().nonnegative().nullable(),
  maxLandingPadSize: z.number().int().min(1).max(3).nullable(),
  moduleClass: z.number().int().min(0).max(8).nullable(),
  moduleName: z.string().min(1),
  moduleRating: nullableString,
  moduleSymbol: nullableString,
  price: nullableNumber,
  ship: nullableString,
  stationName: z.string().min(1),
  stationType: nullableString,
  systemName: z.string().min(1),
  updatedAt: z.string().datetime().nullable()
})

export const GalaxyOutfittingResponseSchema = z.object({
  cache: GalaxyCacheStateSchema,
  matches: z.array(GalaxyOutfittingMatchSchema),
  moduleClass: z.number().int().min(0).max(8).nullable(),
  moduleName: z.string().min(1),
  moduleRating: nullableString,
  originSystem: z.string().min(1)
})

export const GalaxyNearbyStationSchema = z.object({
  allegiance: nullableString,
  controllingFaction: nullableString,
  distanceLy: nullableNumber,
  distanceToArrivalLs: nullableNumber,
  government: nullableString,
  marketId: z.number().int().nonnegative().nullable(),
  maxLandingPadSize: z.number().int().min(1).max(3).nullable(),
  primaryEconomy: nullableString,
  secondaryEconomy: nullableString,
  stationName: z.string().min(1),
  stationType: nullableString,
  systemName: z.string().min(1),
  updatedAt: z.string().datetime().nullable()
})

export const GalaxyNearestStationsResponseSchema = z.object({
  cache: GalaxyCacheStateSchema,
  minimumPadSize: z.enum(['small', 'medium', 'large']).nullable(),
  originSystem: z.string().min(1),
  service: z.string().min(1),
  stations: z.array(GalaxyNearbyStationSchema)
})

export const GalaxyStationLookupResultSchema = GalaxyNearbyStationSchema.extend({
  services: z.array(z.string().min(1))
})

export const GalaxyStationLookupResponseSchema = z.object({
  cache: GalaxyCacheStateSchema,
  matches: z.array(GalaxyStationLookupResultSchema),
  maxDistanceLy: z.number().int().min(1).max(500),
  minimumPadSize: z.enum(['small', 'medium', 'large']).nullable(),
  name: z.string().min(1),
  originSystem: z.string().min(1),
  stationType: z.enum(['any', 'carrier', 'orbital', 'surface'])
})

export const GalaxyCommodityMarketSchema = z.object({
  buyPrice: nullableNumber,
  commodityName: z.string().min(1),
  demand: nullableNumber,
  distanceLy: nullableNumber,
  distanceToArrivalLs: nullableNumber,
  marketId: z.number().int().nonnegative().nullable(),
  maxLandingPadSize: z.number().int().min(1).max(3).nullable(),
  meanPrice: nullableNumber,
  sellPrice: nullableNumber,
  stationName: z.string().min(1),
  stationType: nullableString,
  stock: nullableNumber,
  systemName: z.string().min(1),
  updatedAt: z.string().datetime().nullable()
})

export const GalaxyCommodityMarketsResponseSchema = z.object({
  cache: GalaxyCacheStateSchema,
  commodity: z.string().min(1),
  intent: z.enum(['buy', 'sell']),
  originSystem: z.string().min(1),
  markets: z.array(GalaxyCommodityMarketSchema)
})

export type GalaxyCommodityMarket = z.infer<typeof GalaxyCommodityMarketSchema>
export type GalaxyCommodityMarketsResponse = z.infer<typeof GalaxyCommodityMarketsResponseSchema>
export type GalaxyNearbySystem = z.infer<typeof GalaxyNearbySystemSchema>
export type GalaxyNearbySystemsResponse = z.infer<typeof GalaxyNearbySystemsResponseSchema>
export type GalaxyOutfittingMatch = z.infer<typeof GalaxyOutfittingMatchSchema>
export type GalaxyOutfittingResponse = z.infer<typeof GalaxyOutfittingResponseSchema>
export type GalaxyShipyard = z.infer<typeof GalaxyShipyardSchema>
export type GalaxyShipyardsResponse = z.infer<typeof GalaxyShipyardsResponseSchema>
export type GalaxyNearbyStation = z.infer<typeof GalaxyNearbyStationSchema>
export type GalaxyNearestStationsResponse = z.infer<typeof GalaxyNearestStationsResponseSchema>
export type GalaxyStationLookupResult = z.infer<typeof GalaxyStationLookupResultSchema>
export type GalaxyStationLookupResponse = z.infer<typeof GalaxyStationLookupResponseSchema>
