import { z } from 'zod'

export const AtlasPoiSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1),
  systemName: z.string().trim().min(1),
  position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
  categories: z.array(z.string().trim().min(1)).min(1),
  source: z.string().min(1),
  sourceUrl: z.string().url(),
  bodyName: z.string().trim().min(1).optional(),
  siteType: z.string().trim().min(1).optional(),
  surface: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).optional()
}).strict()

export const AtlasPoiDocumentSchema = z.object({
  pois: z.array(AtlasPoiSchema),
  rejected: z.number().int().nonnegative()
}).strict()

export const AtlasCatalogueResponseSchema = z.object({
  pois: z.array(AtlasPoiSchema),
  sources: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
    licence: z.string().nullable(),
    cache: z.enum(['fresh', 'refreshed', 'stale', 'unavailable']),
    fetchedAt: z.string().datetime().nullable(),
    rejected: z.number().int().nonnegative(),
    error: z.string().nullable()
  }).strict())
}).strict()

export type AtlasPoi = z.infer<typeof AtlasPoiSchema>
export type AtlasPoiDocument = z.infer<typeof AtlasPoiDocumentSchema>
export type AtlasCatalogueResponse = z.infer<typeof AtlasCatalogueResponseSchema>
