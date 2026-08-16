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

export const GalaxyFilteredSystemSchema = z.object({
  allegiance: nullableString,
  controllingFaction: nullableString,
  distanceLy: z.number().finite().nonnegative(),
  economy: nullableString,
  government: nullableString,
  inhabited: z.boolean(),
  permitRequired: z.boolean().nullable(),
  population: z.number().finite().nonnegative(),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
  primaryStarClass: nullableString,
  secondaryEconomy: nullableString,
  security: nullableString,
  systemAddress: z.number().int().nonnegative().nullable(),
  systemName: z.string().min(1),
  updatedAt: z.string().datetime().nullable()
})

export const GalaxyFilteredSystemsResponseSchema = z.object({
  cache: GalaxyCacheStateSchema,
  filters: z.object({
    allegiance: nullableString,
    economy: nullableString,
    government: nullableString,
    maxDistanceLy: z.number().int().min(1).max(500),
    maxPopulation: z.number().int().nonnegative().nullable(),
    minPopulation: z.number().int().nonnegative().nullable(),
    population: z.enum(['any', 'inhabited', 'uninhabited']),
    security: nullableString
  }),
  originSystem: z.string().min(1),
  systems: z.array(GalaxyFilteredSystemSchema)
})

export const GalaxyFactionPresenceSchema = z.object({
  activeStates: z.array(z.string().min(1)),
  allegiance: nullableString,
  controlling: z.boolean(),
  distanceLy: z.number().finite().nonnegative(),
  factionName: z.string().min(1),
  government: nullableString,
  influencePercent: z.number().finite().min(0).max(100),
  pendingStates: z.array(z.string().min(1)),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
  recoveringStates: z.array(z.string().min(1)),
  state: nullableString,
  systemAddress: z.number().int().nonnegative().nullable(),
  systemName: z.string().min(1),
  updatedAt: z.string().datetime().nullable()
})

export const GalaxyFactionPresencesResponseSchema = z.object({
  cache: GalaxyCacheStateSchema,
  filters: z.object({
    allegiance: nullableString,
    controlling: z.enum(['any', 'yes', 'no']),
    factionName: z.string().min(1),
    government: nullableString,
    maxDistanceLy: z.number().int().min(1).max(500),
    minInfluencePercent: z.number().finite().min(0).max(100),
    state: nullableString
  }),
  originSystem: z.string().min(1),
  presences: z.array(GalaxyFactionPresenceSchema),
  provenance: z.literal('Spansh community-reported system data')
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

export const GalaxyTradeOpportunitySchema = z.object({
  buyMarket: GalaxyCommodityMarketSchema,
  commodityName: z.string().min(1),
  projectedProfit: z.number().nonnegative(),
  sellMarket: GalaxyCommodityMarketSchema,
  travelDistanceLy: nullableNumber,
  unitMargin: z.number().positive(),
  units: z.number().int().positive()
})

export const GalaxyTradeOpportunitiesResponseSchema = z.object({
  cache: GalaxyCacheStateSchema,
  candidateCommoditiesChecked: z.number().int().nonnegative(),
  caveat: z.string().min(1),
  exportCommoditiesFound: z.number().int().nonnegative(),
  opportunities: z.array(GalaxyTradeOpportunitySchema),
  originSystem: z.string().min(1)
})

export const GalaxyExplorationTargetSchema = z.object({
  atmosphere: nullableString,
  biologicalSignals: z.number().int().nonnegative(),
  bodyId: z.number().int().nonnegative().nullable(),
  bodyName: z.string().min(1),
  bodyType: nullableString,
  distanceLy: z.number().finite().nonnegative(),
  distanceToArrivalLs: nullableNumber,
  geologicalSignals: z.number().int().nonnegative(),
  gravityG: nullableNumber,
  landable: z.boolean().nullable(),
  localEvidence: z.object({
    biologicalSamplesCompleted: z.number().int().nonnegative(),
    biologicalSignalsRecorded: z.number().int().nonnegative(),
    discovered: z.boolean().nullable(),
    geologicalSignalsRecorded: z.number().int().nonnegative(),
    mapped: z.boolean().nullable(),
    observed: z.boolean(),
    observedAt: z.string().datetime().nullable(),
    surfaceScanCompleted: z.boolean().nullable()
  }),
  providerUpdatedAt: z.string().datetime().nullable(),
  signalsUpdatedAt: z.string().datetime().nullable(),
  subtype: nullableString,
  surfaceTemperatureK: nullableNumber,
  systemAddress: z.number().int().nonnegative().nullable(),
  systemName: z.string().min(1),
  volcanism: nullableString
})

export const GalaxyExplorationTargetsResponseSchema = z.object({
  cache: GalaxyCacheStateSchema,
  candidatesExamined: z.number().int().nonnegative(),
  caveat: z.string().min(1),
  filters: z.object({
    atmosphere: nullableString,
    bodyType: nullableString,
    landable: z.enum(['any', 'yes', 'no']),
    maxDistanceLy: z.number().int().min(1).max(500),
    maxGravityG: nullableNumber,
    maxTemperatureK: nullableNumber,
    minBiologicalSignals: z.number().int().nonnegative(),
    minGeologicalSignals: z.number().int().nonnegative(),
    minGravityG: nullableNumber,
    minTemperatureK: nullableNumber,
    volcanism: nullableString
  }),
  originSystem: z.string().min(1),
  provenance: z.literal('Spansh community-reported body data'),
  targets: z.array(GalaxyExplorationTargetSchema)
})

export type GalaxyCommodityMarket = z.infer<typeof GalaxyCommodityMarketSchema>
export type GalaxyCommodityMarketsResponse = z.infer<typeof GalaxyCommodityMarketsResponseSchema>
export type GalaxyTradeOpportunity = z.infer<typeof GalaxyTradeOpportunitySchema>
export type GalaxyTradeOpportunitiesResponse = z.infer<typeof GalaxyTradeOpportunitiesResponseSchema>
export type GalaxyExplorationTarget = z.infer<typeof GalaxyExplorationTargetSchema>
export type GalaxyExplorationTargetsResponse = z.infer<typeof GalaxyExplorationTargetsResponseSchema>
export type GalaxyFilteredSystem = z.infer<typeof GalaxyFilteredSystemSchema>
export type GalaxyFilteredSystemsResponse = z.infer<typeof GalaxyFilteredSystemsResponseSchema>
export type GalaxyFactionPresence = z.infer<typeof GalaxyFactionPresenceSchema>
export type GalaxyFactionPresencesResponse = z.infer<typeof GalaxyFactionPresencesResponseSchema>
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
