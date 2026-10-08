import type { CommunityGoalsResponse, GalnetAnalysis, GalnetAnalysisContent, GalnetAnalysisResponse, GalnetContinuity, GalnetStorySource } from '@phoenix/contracts'
import type { GalnetArticleRevision } from './galnet.js'

export interface GalnetAnalysisRepository {
  get(cacheKey: string): GalnetAnalysis | null
  latest(articleId: string): GalnetAnalysis | null
  recent(limit: number): GalnetAnalysis[]
  put(analysis: GalnetAnalysis): void
}

export interface SavedGalnetAnalysis {
  analysis: GalnetAnalysis
  currentArticleTitle: string | null
  articleChanged: boolean
  contextChanged: boolean
}

/** Stored evidence only; deliberately has no inference or source-refresh operation. */
export interface SavedGalnetAnalysisReader {
  recent(limit: number): SavedGalnetAnalysis[]
  get(articleId: string): SavedGalnetAnalysis | null
}

export interface GalnetArticleAnalyser {
  readonly model: string
  configured(): boolean
  analyse(article: GalnetArticleRevision, goals: CommunityGoalsResponse, signal: AbortSignal, context: GalnetStoryContext[]): Promise<{
    content: GalnetAnalysisContent
    continuity: GalnetContinuity | null
    usage: GalnetAnalysis['usage']
  }>
}

export interface GalnetStoryContext {
  source: GalnetStorySource
  article: GalnetArticleRevision['article']
  /** Only independent activities are editable leads; campaigns remain in source.communityGoals. */
  activities: { leadId: string, activity: GalnetAnalysis['content']['activities'][number] }[]
}

export interface GalnetAnalysisReader {
  get(articleId: string): GalnetAnalysisResponse
  analyse(articleId: string): Promise<GalnetAnalysisResponse>
}
