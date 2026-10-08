import type { GalnetAnalysis, GalnetContinuity } from '@phoenix/contracts'
import type { GalnetArticleArchive } from '../domain/galnet.js'
import type { GalnetAnalysisRepository, SavedGalnetAnalysis } from '../domain/galnet-analysis.js'

export function galnetContextChanged(analysis: GalnetAnalysis, archive: Pick<GalnetArticleArchive, 'getArticle'>,
  reports: Pick<GalnetAnalysisRepository, 'latest'>): boolean {
  return analysis.schemaVersion === 3 && analysis.context.some(source =>
    archive.getArticle(source.articleId)?.revisionId !== source.articleRevisionId ||
    reports.latest(source.articleId)?.cacheKey !== source.analysisCacheKey)
}

/** Latest explicit per-lead assessment, not latest-article-wins. Equal-date conflicts keep a lead. */
export function reconciledGalnetLeads(reports: SavedGalnetAnalysis[]): Set<string> {
  const decisions = new Map<string, { publishedAt: number, disposition: GalnetContinuity['updates'][number]['disposition'] }>()
  const latest = new Map(reports.map(saved => [saved.analysis.articleId, saved.analysis.cacheKey]))
  for (const saved of reports) {
    const report = saved.analysis
    if (saved.articleChanged || saved.contextChanged || report.schemaVersion !== 3 || !report.continuity) continue
    for (const update of report.continuity.updates) {
      const source = report.context.find(entry => report.continuity!.relatedArticleIds.includes(entry.articleId) &&
        update.leadId.startsWith(`galnet-lead:${entry.analysisCacheKey}:`))
      if (!source || latest.get(source.articleId) !== source.analysisCacheKey) continue
      const publishedAt = Date.parse(report.publishedAt)
      const previous = decisions.get(update.leadId)
      if (!previous || publishedAt > previous.publishedAt) decisions.set(update.leadId, { publishedAt, disposition: update.disposition })
      else if (publishedAt === previous.publishedAt && previous.disposition !== update.disposition) previous.disposition = 'unresolved'
    }
  }
  return new Set([...decisions].filter(([, decision]) => decision.disposition !== 'unresolved').map(([id]) => id))
}
