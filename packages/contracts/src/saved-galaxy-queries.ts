import { z } from 'zod'

export const GALAXY_QUERY_IDS = [
  'commodity-markets',
  'facilities',
  'exploration-targets',
  'faction-presence',
  'outfitting-stock',
  'shipyards',
  'station-lookup',
  'system-search',
  'trade-opportunities'
] as const

export const GalaxyQueryIdSchema = z.enum(GALAXY_QUERY_IDS)
export const GalaxyQueryParameterValueSchema = z.union([
  z.string().max(2_048),
  z.array(z.string().max(2_048)).max(100)
])
export const GalaxyQueryParametersSchema = z.record(
  z.string().min(1).max(64),
  GalaxyQueryParameterValueSchema
).refine(parameters => Object.keys(parameters).length <= 64, 'A saved query may contain at most 64 parameters.')

export const SavedGalaxyQueryWriteRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  parameters: GalaxyQueryParametersSchema,
  queryId: GalaxyQueryIdSchema
}).strict()

export const SavedGalaxyQuerySchema = SavedGalaxyQueryWriteRequestSchema.extend({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  schemaVersion: z.literal(1),
  updatedAt: z.string().datetime({ offset: true })
}).strict()

export const SavedGalaxyQueriesResponseSchema = z.object({
  queries: z.array(SavedGalaxyQuerySchema)
}).strict()

export type GalaxyQueryId = z.infer<typeof GalaxyQueryIdSchema>
export type GalaxyQueryParameterValue = z.infer<typeof GalaxyQueryParameterValueSchema>
export type GalaxyQueryParameters = z.infer<typeof GalaxyQueryParametersSchema>
export type SavedGalaxyQuery = z.infer<typeof SavedGalaxyQuerySchema>
export type SavedGalaxyQueryWriteRequest = z.infer<typeof SavedGalaxyQueryWriteRequestSchema>
export type SavedGalaxyQueriesResponse = z.infer<typeof SavedGalaxyQueriesResponseSchema>
