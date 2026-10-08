import { z } from 'zod'
import { GalnetArticleSchema, type GalnetNewsResponse, type GalnetArchiveQuery, type GalnetArchiveResponse } from '@phoenix/contracts'

export const GalnetSourceArticleSchema = GalnetArticleSchema.extend({
  changedAt: z.string().datetime({ offset: true }),
  slug: z.string().min(1).nullable(),
  sourceUrl: z.string().url()
}).strict()

export type GalnetSourceArticle = z.infer<typeof GalnetSourceArticleSchema>

export interface GalnetArticleRevision {
  schemaVersion: 1
  revisionId: string
  article: GalnetSourceArticle
  firstObservedAt: string
  lastObservedAt: string
}

export interface GalnetArticleArchive {
  observe(articles: GalnetSourceArticle[], observedAt: string): void
  getArticle(id: string): GalnetArticleRevision | null
  listRevisions(id: string): GalnetArticleRevision[]
  recent(limit: number): GalnetArticleRevision[]
}

export interface GalnetSource {
  getLatest(limit: number): Promise<GalnetSourceArticle[]>
}

export interface GalnetArchiveBrowser extends Pick<GalnetArticleArchive, 'getArticle'> {
  search(query: GalnetArchiveQuery): GalnetArchiveResponse
}

export interface GalnetNewsReader {
  getLatest(limit?: number): Promise<GalnetNewsResponse>
}
