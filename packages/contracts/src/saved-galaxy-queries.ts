import { z } from 'zod'

export const GALAXY_QUERY_IDS = [
  'commodity-markets',
  'facilities',
  'exploration-targets',
  'faction-presence',
  'market-signals',
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
  .refine(parameters => parameters.originMode === undefined || parameters.originMode === 'current' || parameters.originMode === 'fixed', 'originMode must be current or fixed.')

export const SavedGalaxyQueryWriteRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  parameters: GalaxyQueryParametersSchema,
  queryId: GalaxyQueryIdSchema,
  useOnDashboard: z.boolean()
}).strict()

export const SavedGalaxyQuerySchema = SavedGalaxyQueryWriteRequestSchema.extend({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  schemaVersion: z.literal(2),
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

/** Legacy saved queries remain fixed; live origins are resolved only when executing. */
export function galaxyQueryOriginMode(parameters: GalaxyQueryParameters): 'current' | 'fixed' {
  return parameters.originMode === 'current' ? 'current' : 'fixed'
}

export function resolveGalaxyQueryOrigin(parameters: GalaxyQueryParameters, currentSystem: string | null): string {
  return (galaxyQueryOriginMode(parameters) === 'current' ? currentSystem ?? '' : typeof parameters.origin === 'string' ? parameters.origin : '').trim()
}
