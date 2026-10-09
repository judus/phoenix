import { z } from 'zod'
import { GalnetAnalysisSchema } from './galnet-analysis.js'

export const GalnetCoverageResponseSchema = z.object({
  subjects: z.array(z.string()),
  reports: z.array(z.object({
    currentArticleTitle: z.string().nullable(), articleChanged: z.boolean(), contextChanged: z.boolean(), analysis: GalnetAnalysisSchema
  }).strict())
}).strict()
export type GalnetCoverageResponse = z.infer<typeof GalnetCoverageResponseSchema>
