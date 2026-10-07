import type { CommunityGoalsResponse, GalnetAnalysis, GalnetAnalysisContent, GalnetAnalysisResponse } from '@phoenix/contracts'
import type { GalnetArticleRevision } from './galnet.js'

export interface GalnetAnalysisRepository {
  get(cacheKey: string): GalnetAnalysis | null
  latest(articleId: string): GalnetAnalysis | null
  put(analysis: GalnetAnalysis): void
}

export interface GalnetArticleAnalyser {
  readonly model: string
  configured(): boolean
  analyse(article: GalnetArticleRevision, goals: CommunityGoalsResponse, signal: AbortSignal): Promise<{
    content: GalnetAnalysisContent
    usage: GalnetAnalysis['usage']
  }>
}

export interface GalnetAnalysisReader {
  get(articleId: string): GalnetAnalysisResponse
  analyse(articleId: string): Promise<GalnetAnalysisResponse>
}
