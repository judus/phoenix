import { z } from 'zod'
import { CurrentSystemSchema } from './runtime.js'

const ExternalRecordSchema = z.record(z.string(), z.unknown())

export const CartographicBodySchema = z.object({
  id: z.number().int().nonnegative().nullable(),
  id64: z.number().int().nonnegative().nullable(),
  bodyId: z.number().int().nonnegative().nullable(),
  name: z.string().min(1),
  type: z.string().min(1).nullable(),
  subType: z.string().min(1).nullable(),
  distanceToArrival: z.number().finite().nonnegative().nullable(),
  parents: z.array(ExternalRecordSchema),
  local: z.object({
    observedAt: z.iso.datetime(),
    discovered: z.boolean().nullable(),
    mapped: z.boolean().nullable(),
    surfaceScanCompleted: z.boolean(),
    signals: z.object({
      biological: z.number().int().nonnegative(),
      geological: z.number().int().nonnegative(),
      human: z.number().int().nonnegative()
    }),
    biologicalGenuses: z.array(z.string().min(1)),
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
  schemaVersion: z.literal(1),
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
  source: z.object({
    provider: z.literal('edsm'),
    fetchedAt: z.iso.datetime()
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

export const CartographyLookupResponseSchema = z.object({
  cache: z.enum(['fresh', 'refreshed', 'stale']),
  system: CartographicSystemSchema
})

export const DisplayCommandSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['show_system', 'show_body']),
  systemName: z.string().min(1),
  selectedName: z.string().min(1).nullable(),
  createdAt: z.iso.datetime()
})

export type CartographicBody = z.infer<typeof CartographicBodySchema>
export type CartographicStation = z.infer<typeof CartographicStationSchema>
export type CartographicSystem = z.infer<typeof CartographicSystemSchema>
export type CartographyLookupResponse = z.infer<typeof CartographyLookupResponseSchema>
export type DisplayCommand = z.infer<typeof DisplayCommandSchema>
export type NavigationRoute = z.infer<typeof NavigationRouteSchema>
export type NavigationRouteHop = z.infer<typeof NavigationRouteHopSchema>
