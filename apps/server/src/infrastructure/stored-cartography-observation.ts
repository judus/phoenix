import { z } from 'zod'
import type { LocalSystemCartographyObservation } from '../domain/cartography.js'

const StoredRecordSchema = z.record(z.string(), z.unknown())

const StoredOrganicSampleSchema = z.object({
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
})

const StoredBodyObservationSchema = z.object({
  bodyId: z.number().int().nonnegative().nullable(),
  bodyName: z.string().min(1),
  bodySignals: StoredRecordSchema.nullable(),
  footfallCompleted: z.boolean().default(false),
  previouslyDiscovered: z.boolean().nullable(),
  previouslyFootfalled: z.boolean().nullable(),
  previouslyMapped: z.boolean().nullable(),
  observedAt: z.iso.datetime(),
  organicSamples: z.array(StoredOrganicSampleSchema).default([]),
  scan: StoredRecordSchema.nullable(),
  surfaceScanCompleted: z.boolean(),
  surfaceSignals: StoredRecordSchema.nullable()
})

const StoredSystemObservationSchema: z.ZodType<LocalSystemCartographyObservation> = z.object({
  allBodiesFound: z.boolean().default(false),
  bodies: z.array(StoredBodyObservationSchema),
  reportedBodyCount: z.number().int().nonnegative().nullable(),
  systemAddress: z.number().int().nonnegative().nullable(),
  systemName: z.string().min(1),
  updatedAt: z.iso.datetime()
})

export function parseStoredCartographyObservation (document: string): LocalSystemCartographyObservation {
  return StoredSystemObservationSchema.parse(JSON.parse(document))
}

export function upgradeStoredCartographyObservation (document: string): LocalSystemCartographyObservation {
  const candidate = JSON.parse(document) as Record<string, unknown>
  const bodies = Array.isArray(candidate.bodies)
    ? candidate.bodies.map(value => {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return value
        const body = value as Record<string, unknown>
        const {
          discovered: _discovered,
          footfalled: _footfalled,
          mapped: _mapped,
          ...rest
        } = body
        return {
          ...rest,
          previouslyDiscovered: body.previouslyDiscovered ?? body.discovered ?? null,
          previouslyFootfalled: body.previouslyFootfalled ?? body.footfalled ?? null,
          previouslyMapped: body.previouslyMapped ?? body.mapped ?? null
        }
      })
    : candidate.bodies
  return StoredSystemObservationSchema.parse({ ...candidate, bodies })
}
