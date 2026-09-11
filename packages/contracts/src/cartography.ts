import { z } from 'zod'
import { CurrentSystemSchema } from './runtime.js'

const ExternalRecordSchema = z.record(z.string(), z.unknown())

const CartographicCompositionSchema = z.object({
  icePercent: z.number().finite().min(0).max(100).nullable(),
  metalPercent: z.number().finite().min(0).max(100).nullable(),
  rockPercent: z.number().finite().min(0).max(100).nullable()
})

const CartographicConstituentSchema = z.object({
  name: z.string().min(1),
  percent: z.number().finite().min(0).max(100)
})

const CartographicOrbitSchema = z.object({
  ascendingNodeDegrees: z.number().finite().nullable(),
  axialTiltDegrees: z.number().finite().nullable(),
  eccentricity: z.number().finite().nonnegative().nullable(),
  inclinationDegrees: z.number().finite().nullable(),
  meanAnomalyDegrees: z.number().finite().nullable(),
  orbitalPeriodSeconds: z.number().finite().nullable(),
  periapsisDegrees: z.number().finite().nullable(),
  rotationPeriodSeconds: z.number().finite().nullable(),
  semiMajorAxisKilometres: z.number().finite().nullable()
})

const CartographicRingSchema = z.object({
  innerRadiusKilometres: z.number().finite().nonnegative().nullable(),
  massMegatonnes: z.number().finite().nonnegative().nullable(),
  name: z.string().min(1),
  outerRadiusKilometres: z.number().finite().nonnegative().nullable(),
  type: z.string().min(1).nullable()
})

const CartographicBodyDetailsSchema = z.object({
  absoluteMagnitude: z.number().finite().nullable(),
  ageMillionYears: z.number().finite().nonnegative().nullable(),
  atmosphereComposition: z.array(CartographicConstituentSchema),
  isMainStar: z.boolean().nullable(),
  isScoopable: z.boolean().nullable(),
  luminosity: z.string().min(1).nullable(),
  massEarths: z.number().finite().nonnegative().nullable(),
  materials: z.array(CartographicConstituentSchema),
  orbit: CartographicOrbitSchema,
  reserveLevel: z.string().min(1).nullable(),
  rings: z.array(CartographicRingSchema),
  scanType: z.string().min(1).nullable(),
  solarMasses: z.number().finite().nonnegative().nullable(),
  solarRadius: z.number().finite().nonnegative().nullable(),
  solidComposition: CartographicCompositionSchema.nullable(),
  spectralClass: z.string().min(1).nullable(),
  starSubclass: z.number().int().min(0).max(9).nullable(),
  surfacePressurePascals: z.number().finite().nonnegative().nullable(),
  terraformState: z.string().min(1).nullable(),
  tidallyLocked: z.boolean().nullable(),
  volcanism: z.string().min(1).nullable()
})

const CartographicSignalSchema = z.object({
  count: z.number().int().nonnegative(),
  type: z.string().min(1)
})

export const CartographicBodySchema = z.object({
  id: z.number().int().nonnegative().nullable(),
  id64: z.number().int().nonnegative().nullable(),
  bodyId: z.number().int().nonnegative().nullable(),
  name: z.string().min(1),
  type: z.string().min(1).nullable(),
  subType: z.string().min(1).nullable(),
  distanceToArrival: z.number().finite().nonnegative().nullable(),
  parents: z.array(ExternalRecordSchema),
  landable: z.boolean().nullable(),
  gravityGs: z.number().finite().nonnegative().nullable(),
  surfaceTemperatureKelvin: z.number().finite().nonnegative().nullable(),
  radiusKilometres: z.number().finite().nonnegative().nullable(),
  atmosphere: z.string().min(1).nullable(),
  ringed: z.boolean(),
  details: CartographicBodyDetailsSchema,
  firstDiscoveredBy: z.string().min(1).nullable(),
  firstFootfallBy: z.string().min(1).nullable(),
  firstMappedBy: z.string().min(1).nullable(),
  local: z.object({
    observedAt: z.iso.datetime(),
    discovered: z.boolean().nullable(),
    footfalled: z.boolean().nullable().default(null),
    mapped: z.boolean().nullable(),
    firstDiscoveredByCommander: z.boolean(),
    firstMappedByCommander: z.boolean(),
    previouslyFootfalled: z.boolean().nullable(),
    surfaceScanCompleted: z.boolean(),
    signals: z.object({
      biological: z.number().int().nonnegative(),
      geological: z.number().int().nonnegative(),
      human: z.number().int().nonnegative()
    }),
    signalDetails: z.array(CartographicSignalSchema),
    biologicalGenuses: z.array(z.string().min(1)),
    organicSamples: z.array(z.object({
      completed: z.boolean(),
      genus: z.string().min(1),
      genusId: z.string().min(1).nullable(),
      lastUpdated: z.iso.datetime(),
      progress: z.number().int().min(0).max(3),
      scanTypes: z.array(z.string().min(1)),
      species: z.string().min(1),
      speciesId: z.string().min(1).nullable(),
      variant: z.string().min(1),
      variantId: z.string().min(1).nullable()
    })).default([]),
    raw: z.object({
      scan: ExternalRecordSchema.nullable(),
      bodySignals: ExternalRecordSchema.nullable(),
      surfaceSignals: ExternalRecordSchema.nullable()
    })
  }).nullable(),
  raw: ExternalRecordSchema
})

export const CartographicStationSchema = z.object({
  id: z.number().int().nonnegative().nullable(),
  marketId: z.number().int().nonnegative().nullable(),
  name: z.string().min(1),
  type: z.string().min(1).nullable(),
  distanceToArrival: z.number().finite().nonnegative().nullable(),
  allegiance: z.string().min(1).nullable(),
  government: z.string().min(1).nullable(),
  economy: z.string().min(1).nullable(),
  secondEconomy: z.string().min(1).nullable(),
  controllingFaction: z.string().min(1).nullable(),
  services: z.array(z.string().min(1)),
  facilities: z.object({
    market: z.boolean(),
    shipyard: z.boolean(),
    outfitting: z.boolean()
  }),
  raw: ExternalRecordSchema
})

export const CartographicSystemSchema = z.object({
  schemaVersion: z.literal(5),
  name: z.string().min(1),
  address: z.number().int().nonnegative().nullable(),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).nullable(),
  permitRequired: z.boolean().nullable(),
  permitName: z.string().min(1).nullable(),
  information: z.object({
    allegiance: z.string().min(1).nullable(),
    government: z.string().min(1).nullable(),
    security: z.string().min(1).nullable(),
    state: z.string().min(1).nullable(),
    primaryEconomy: z.string().min(1).nullable(),
    secondaryEconomy: z.string().min(1).nullable(),
    population: z.number().int().nonnegative().nullable(),
    controllingFaction: z.string().min(1).nullable()
  }),
  primaryStar: ExternalRecordSchema.nullable(),
  bodies: z.array(CartographicBodySchema),
  stations: z.array(CartographicStationSchema),
  scanProgress: z.object({
    knownBodies: z.number().int().nonnegative(),
    reportedBodies: z.number().int().nonnegative().nullable(),
    percent: z.number().int().min(0).max(100).nullable()
  }),
  localSystem: CurrentSystemSchema.nullable(),
  provenance: z.object({
    edsm: z.object({
      fetchedAt: z.iso.datetime()
    }).nullable(),
    journal: z.object({
      updatedAt: z.iso.datetime()
    }).nullable()
  }).refine(value => value.edsm !== null || value.journal !== null, {
    message: 'Cartography must identify at least one source.'
  }),
  raw: z.object({
    system: ExternalRecordSchema,
    bodies: ExternalRecordSchema,
    stations: ExternalRecordSchema
  })
})

export const NavigationRouteHopSchema = z.object({
  system: z.string().min(1),
  address: z.number().int().nonnegative().nullable(),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).nullable(),
  starClass: z.string().min(1).nullable()
})

export const NavigationRouteSchema = z.object({
  timestamp: z.iso.datetime().nullable(),
  route: z.array(NavigationRouteHopSchema)
})

export const EliteDestinationPhaseSchema = z.enum([
  'preflight',
  'open_map',
  'focus_search',
  'enter_destination',
  'select_result',
  'plot_route',
  'confirm_route',
  'close_map'
])

export const PlotEliteDestinationRequestSchema = z.object({
  systemName: z.string().trim().min(1).max(128)
})

export const PlotEliteDestinationResultSchema = z.object({
  requestedSystem: z.string().min(1),
  confirmedSystem: z.string().min(1).nullable(),
  status: z.enum(['confirmed', 'rejected', 'failed', 'timed_out']),
  phase: EliteDestinationPhaseSchema,
  message: z.string().min(1)
})

export const CartographyLookupResponseSchema = z.object({
  cache: z.enum(['fresh', 'refreshed', 'stale', 'local']),
  system: CartographicSystemSchema
})

export const CartographyUpdateSchema = z.object({
  system: CartographicSystemSchema,
  systemName: z.string().min(1),
  updatedAt: z.iso.datetime()
})

export type CartographicBody = z.infer<typeof CartographicBodySchema>
export type CartographicStation = z.infer<typeof CartographicStationSchema>
export type CartographicSystem = z.infer<typeof CartographicSystemSchema>
export type CartographyLookupResponse = z.infer<typeof CartographyLookupResponseSchema>
export type CartographyUpdate = z.infer<typeof CartographyUpdateSchema>
export type NavigationRoute = z.infer<typeof NavigationRouteSchema>
export type NavigationRouteHop = z.infer<typeof NavigationRouteHopSchema>
export type EliteDestinationPhase = z.infer<typeof EliteDestinationPhaseSchema>
export type PlotEliteDestinationRequest = z.infer<typeof PlotEliteDestinationRequestSchema>
export type PlotEliteDestinationResult = z.infer<typeof PlotEliteDestinationResultSchema>
