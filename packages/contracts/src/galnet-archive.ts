import { z } from 'zod'
import { GalnetArticleSchema } from './galnet.js'

export const GalnetArchiveQuerySchema = z.object({
  query: z.string().trim().max(200).default(''),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  offset: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0)
}).strict()

export const GalnetArchiveResponseSchema = z.object({
  articles: z.array(GalnetArticleSchema.pick({ id: true, title: true, publishedAt: true })),
  total: z.number().int().nonnegative(), limit: z.number().int().positive(), offset: z.number().int().nonnegative()
}).strict()

export const GalnetArchivedArticleSchema = z.object({
  article: GalnetArticleSchema,
  revisionId: z.string().min(1), sourceUrl: z.string().url(),
  changedAt: z.string().datetime({ offset: true }),
  firstObservedAt: z.string().datetime({ offset: true }), lastObservedAt: z.string().datetime({ offset: true })
}).strict()

export type GalnetArchiveQuery = z.infer<typeof GalnetArchiveQuerySchema>
export type GalnetArchiveResponse = z.infer<typeof GalnetArchiveResponseSchema>
export type GalnetArchivedArticle = z.infer<typeof GalnetArchivedArticleSchema>
