import { z } from 'zod'
import { CommunityGoalsResponseSchema } from './community-goals.js'

const text = z.string().min(1).max(1200)
const evidence = z.string().min(1).max(800)
const claim = z.object({ text, evidence }).strict()

const GalnetAnalysisContentV1Schema = z.object({
  summary: text,
  facts: z.array(claim).max(8),
  interpretations: z.array(claim).max(6),
  entities: z.array(z.object({
    name: z.string().min(1).max(200),
    kind: z.enum(['region', 'system', 'body', 'station', 'ship', 'person', 'faction']),
    role: text,
    evidence
  }).strict()).max(12),
  activities: z.array(z.object({
    title: z.string().min(1).max(160),
    action: text,
    evidence,
    status: z.enum(['unknown', 'ongoing', 'ended']),
    communityGoalId: z.string().min(1).nullable(),
    relationship: z.enum(['none', 'explicit', 'possible'])
  }).strict()).max(8)
}).strict()

export const GalnetAnalysisContentSchema = GalnetAnalysisContentV1Schema.extend({
  activities: z.array(GalnetAnalysisContentV1Schema.shape.activities.element.extend({
    destination: z.object({ systemName: z.string().trim().min(1).max(200), evidence }).strict().nullable()
  })).max(8)
})

const storyEvidence = z.object({ articleId: z.string().min(1).max(200), quote: evidence }).strict()
export const GalnetContinuitySchema = z.object({
  summary: text,
  relatedArticleIds: z.array(z.string().min(1).max(200)).min(1).max(5),
  developments: z.array(z.object({ text, evidence: storyEvidence }).strict()).min(1).max(8),
  updates: z.array(z.object({
    leadId: z.string().min(1).max(300),
    disposition: z.enum(['unresolved', 'resolved', 'superseded', 'community-goal']),
    explanation: text,
    evidence: storyEvidence,
    replacementActivityIndex: z.number().int().min(0).max(7).nullable(),
    communityGoalId: z.string().min(1).nullable()
  }).strict()).max(40)
}).strict()

export const GalnetStorySourceSchema = z.object({
  articleId: z.string().min(1), articleRevisionId: z.string().min(1), analysisCacheKey: z.string().min(1),
  title: z.string(), sourceUrl: z.string().url(), publishedAt: z.string().datetime({ offset: true }),
  communityGoals: CommunityGoalsResponseSchema
}).strict()

export const GalnetAnalysisOutputSchema = z.object({
  content: GalnetAnalysisContentSchema, continuity: GalnetContinuitySchema.nullable()
}).strict()

const report = z.object({
  cacheKey: z.string().min(1),
  articleId: z.string().min(1),
  articleRevisionId: z.string().min(1),
  sourceUrl: z.string().url(),
  publishedAt: z.string().datetime({ offset: true }),
  analysedAt: z.string().datetime({ offset: true }),
  model: z.string().min(1),
  communityGoals: CommunityGoalsResponseSchema,
  usage: z.object({
    inputTokens: z.number().int().nonnegative().nullable(),
    outputTokens: z.number().int().nonnegative().nullable()
  }).strict(),
}).strict()

// Retain real saved v1 evidence without inventing the activity/destination relationship it lacks.
export const GalnetAnalysisSchema = z.discriminatedUnion('schemaVersion', [
  report.extend({ schemaVersion: z.literal(1), extractorVersion: z.literal('galnet-analysis-v1'), content: GalnetAnalysisContentV1Schema }),
  report.extend({ schemaVersion: z.literal(2), extractorVersion: z.literal('galnet-analysis-v2'), content: GalnetAnalysisContentSchema }),
  report.extend({ schemaVersion: z.literal(3), extractorVersion: z.literal('galnet-analysis-v3'), content: GalnetAnalysisContentSchema,
    context: z.array(GalnetStorySourceSchema).max(5), continuity: GalnetContinuitySchema.nullable() })
])

export const GalnetAnalysisResponseSchema = z.object({
  configured: z.boolean(),
  articleAvailable: z.boolean(),
  articleChanged: z.boolean(),
  contextChanged: z.boolean(),
  analysis: GalnetAnalysisSchema.nullable()
}).strict()

export const GalnetAnalyseRequestSchema = z.object({ articleId: z.string().min(1).max(200) }).strict()

export type GalnetAnalysisContent = z.infer<typeof GalnetAnalysisContentSchema>
export type GalnetAnalysis = z.infer<typeof GalnetAnalysisSchema>
export type GalnetAnalysisResponse = z.infer<typeof GalnetAnalysisResponseSchema>
export type GalnetContinuity = z.infer<typeof GalnetContinuitySchema>
export type GalnetStorySource = z.infer<typeof GalnetStorySourceSchema>
