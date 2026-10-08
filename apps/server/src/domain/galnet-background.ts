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
  observe(articleId: string, revisionId: string): string | null
  enqueue(job: GalnetBackgroundJob): void
  put(job: GalnetBackgroundJob): void
  list(state?: GalnetBackgroundJob['state'], limit?: number): GalnetBackgroundJob[]
  next(includeAutomatic: boolean): GalnetBackgroundJob | null
  activeArticleIds(): string[]
  pending(): number
  requestsSince(since: string): number
}
