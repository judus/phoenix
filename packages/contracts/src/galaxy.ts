import { z } from 'zod'

const nullableNumber = z.number().finite().nonnegative().nullable()
const nullableString = z.string().min(1).nullable()

export const GalaxyCacheStateSchema = z.enum(['fresh', 'refreshed', 'stale'])

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
export type GalaxyNearbyStation = z.infer<typeof GalaxyNearbyStationSchema>
export type GalaxyNearestStationsResponse = z.infer<typeof GalaxyNearestStationsResponseSchema>
