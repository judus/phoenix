import { z } from 'zod'

export const GalnetInvestigationLeadSchema = z.object({
  id: z.string(), articleId: z.string(), articleRevisionId: z.string(), articleTitle: z.string().nullable(),
  sourceUrl: z.string().url(), publishedAt: z.string().datetime({ offset: true }),
  analysedAt: z.string().datetime({ offset: true }), model: z.string(),
  title: z.string(), action: z.string(), evidence: z.string(), destinationEvidence: z.string(),
  systemName: z.string(), status: z.enum(['unknown', 'ongoing'])
}).strict()

export const GalnetInvestigationLeadsResponseSchema = z.object({
  leads: z.array(GalnetInvestigationLeadSchema), reportLimit: z.literal(20),
  omitted: z.object({ legacyReports: z.number().int().nonnegative(), changedReports: z.number().int().nonnegative(),
    endedLeads: z.number().int().nonnegative(), withoutDestination: z.number().int().nonnegative() }).strict()
}).strict()

export type GalnetInvestigationLead = z.infer<typeof GalnetInvestigationLeadSchema>
export type GalnetInvestigationLeadsResponse = z.infer<typeof GalnetInvestigationLeadsResponseSchema>
