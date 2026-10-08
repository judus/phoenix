import type { GalnetAnalysis } from '@phoenix/contracts'
import type { GalnetArticleArchive } from '../domain/galnet.js'
import type { GalnetAnalysisRepository, SavedGalnetAnalysis, SavedGalnetAnalysisReader } from '../domain/galnet-analysis.js'
import { galnetContextChanged } from './galnet-lead-reconciliation.js'

export class SavedGalnetAnalysisService implements SavedGalnetAnalysisReader {
  public constructor (
    private readonly reports: Pick<GalnetAnalysisRepository, 'recent' | 'latest'>,
    private readonly articles: Pick<GalnetArticleArchive, 'getArticle'>
  ) {}

  public recent (limit: number): SavedGalnetAnalysis[] {
    return this.reports.recent(limit).map(report => this.describe(report))
  }

  public get (articleId: string): SavedGalnetAnalysis | null {
    const report = this.reports.latest(articleId)
    return report ? this.describe(report) : null
  }

  private describe (analysis: GalnetAnalysis): SavedGalnetAnalysis {
    const current = this.articles.getArticle(analysis.articleId)
    return { analysis, currentArticleTitle: current?.article.title ?? null,
      contextChanged: galnetContextChanged(analysis, this.articles, this.reports),
      articleChanged: current?.revisionId !== analysis.articleRevisionId }
  }
}
