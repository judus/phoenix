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
export type GalaxyNearbyStation = z.infer<typeof GalaxyNearbyStationSchema>
export type GalaxyNearestStationsResponse = z.infer<typeof GalaxyNearestStationsResponseSchema>
