import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { SavedGalaxyQueryWriteRequestSchema } from '@phoenix/contracts'
import type { PredefinedGalaxyQuery } from '../domain/saved-galaxy-queries.js'

const PredefinedGalaxyQuerySchema = SavedGalaxyQueryWriteRequestSchema.extend({
  id: z.string().uuid(),
  useOnDashboard: z.literal(false)
})
const CatalogueSchema = z.object({
  schemaVersion: z.literal(1),
  queries: z.array(PredefinedGalaxyQuerySchema).refine(queries => new Set(queries.map(query => query.id)).size === queries.length, 'Duplicate predefined query IDs.')
}).strict()

/** Bundled definitions are copied into user data; they never replace edited saved queries. */
export function loadPredefinedGalaxyQueries(directory: string): PredefinedGalaxyQuery[] {
  return CatalogueSchema.parse(JSON.parse(readFileSync(join(directory, 'predefined.json'), 'utf8'))).queries
}
