import type { GalnetBackgroundJob, GalnetBackgroundSettings } from '@phoenix/contracts'

export interface GalnetBackgroundState extends GalnetBackgroundSettings {
  installedAt: string
  lastCheckedAt: string | null
  sourceError: string | null
  goals: Record<string, string>
}

export interface GalnetBackgroundRepository {
  load(): GalnetBackgroundState
  save(state: GalnetBackgroundState): void
  observed(articleId: string): string | null
  observe(articleId: string, revisionId: string): string | null
  /** False when pending capacity is exhausted; an already durable job counts as admitted. */
  enqueue(job: GalnetBackgroundJob): boolean
  put(job: GalnetBackgroundJob): void
  list(state?: GalnetBackgroundJob['state'], limit?: number): GalnetBackgroundJob[]
  next(includeAutomatic: boolean, blockedArticleIds?: string[]): GalnetBackgroundJob | null
  activeArticleIds(): string[]
  pending(): number
  requestsSince(since: string): number
}
