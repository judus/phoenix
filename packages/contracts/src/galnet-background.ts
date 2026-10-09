import { z } from 'zod'

export const GalnetBackgroundSettingsSchema = z.object({
  enabled: z.boolean(),
  dailyLimit: z.number().int().min(1).max(50)
}).strict()

export const GalnetBackgroundJobSchema = z.object({
  id: z.string(), articleId: z.string(), articleRevisionId: z.string(), title: z.string(),
  reason: z.enum(['article', 'community-goal', 'catch-up', 'story-context']),
  state: z.enum(['pending', 'running', 'succeeded', 'failed', 'skipped']),
  queuedAt: z.string(), startedAt: z.string().nullable(), finishedAt: z.string().nullable(),
  error: z.string().nullable()
}).strict()

export const GalnetBackgroundStatusSchema = GalnetBackgroundSettingsSchema.extend({
  configured: z.boolean(), installedAt: z.string(), lastCheckedAt: z.string().nullable(),
  sourceError: z.string().nullable(), requestsToday: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(), jobs: z.array(GalnetBackgroundJobSchema),
  backlog: z.array(z.object({ articleId: z.string(), title: z.string(), publishedAt: z.string() }).strict())
}).strict()

export const GalnetCatchUpRequestSchema = z.object({
  articleIds: z.array(z.string().min(1).max(200)).min(1).max(20)
}).strict()

export type GalnetBackgroundSettings = z.infer<typeof GalnetBackgroundSettingsSchema>
export type GalnetBackgroundStatus = z.infer<typeof GalnetBackgroundStatusSchema>
export type GalnetBackgroundJob = z.infer<typeof GalnetBackgroundJobSchema>
