import { z } from 'zod'

export const GalnetArticleSchema = z.object({
  body: z.string(),
  id: z.string().min(1),
  image: z.string().nullable(),
  publishedAt: z.string().datetime({ offset: true }),
  title: z.string().min(1)
}).strict()

export const GalnetNewsResponseSchema = z.object({
  articles: z.array(GalnetArticleSchema),
  cache: z.enum(['fresh', 'refreshed', 'stale']),
  fetchedAt: z.string().datetime({ offset: true })
}).strict()

export type GalnetArticle = z.infer<typeof GalnetArticleSchema>
export type GalnetNewsResponse = z.infer<typeof GalnetNewsResponseSchema>
