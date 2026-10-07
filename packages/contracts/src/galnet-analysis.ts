import { z } from 'zod'
import { CommunityGoalsResponseSchema } from './community-goals.js'

const text = z.string().min(1).max(1200)
const evidence = z.string().min(1).max(800)
const claim = z.object({ text, evidence }).strict()

export const GalnetAnalysisContentSchema = z.object({
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

export const GalnetAnalysisSchema = z.object({
  schemaVersion: z.literal(1),
  extractorVersion: z.literal('galnet-analysis-v1'),
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
  content: GalnetAnalysisContentSchema
}).strict()

export const GalnetAnalysisResponseSchema = z.object({
  configured: z.boolean(),
  articleAvailable: z.boolean(),
  articleChanged: z.boolean(),
  analysis: GalnetAnalysisSchema.nullable()
}).strict()

export const GalnetAnalyseRequestSchema = z.object({ articleId: z.string().min(1).max(200) }).strict()

export type GalnetAnalysisContent = z.infer<typeof GalnetAnalysisContentSchema>
export type GalnetAnalysis = z.infer<typeof GalnetAnalysisSchema>
export type GalnetAnalysisResponse = z.infer<typeof GalnetAnalysisResponseSchema>
