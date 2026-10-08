import type { GalnetAnalysis, GalnetContinuity } from '@phoenix/contracts'
import type { GalnetArticleArchive } from '../domain/galnet.js'
import type { GalnetAnalysisRepository, SavedGalnetAnalysis } from '../domain/galnet-analysis.js'

export function galnetContextChanged(analysis: GalnetAnalysis, archive: Pick<GalnetArticleArchive, 'getArticle'>,
  reports: Pick<GalnetAnalysisRepository, 'latest'>): boolean {
  return analysis.schemaVersion === 3 && analysis.context.some(source =>
    archive.getArticle(source.articleId)?.revisionId !== source.articleRevisionId ||
    reports.latest(source.articleId)?.cacheKey !== source.analysisCacheKey)
}

interface GalnetLeadAssessment {
  articleId: string
  articleRevisionId: string
  analysisCacheKey: string
  sourceUrl: string
  publishedAt: string
  analysedAt: string
  model: string
  evidenceSourceUrl: string
  update: GalnetContinuity['updates'][number]
}

export interface GalnetLeadDecision {
  disposition: GalnetContinuity['updates'][number]['disposition']
  assessments: GalnetLeadAssessment[]
}

/** Latest explicit per-lead assessment, not latest-article-wins. Equal-date conflicts keep a lead. */
export function galnetLeadDecisions(reports: SavedGalnetAnalysis[]): Map<string, GalnetLeadDecision> {
  const decisions = new Map<string, GalnetLeadDecision>()
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
      const assessment: GalnetLeadAssessment = { articleId: report.articleId, articleRevisionId: report.articleRevisionId,
        analysisCacheKey: report.cacheKey, sourceUrl: report.sourceUrl, publishedAt: report.publishedAt,
        analysedAt: report.analysedAt, model: report.model, update,
        evidenceSourceUrl: update.evidence.articleId === report.articleId ? report.sourceUrl
          : report.context.find(entry => entry.articleId === update.evidence.articleId)!.sourceUrl }
      if (!previous || publishedAt > Date.parse(previous.assessments[0]!.publishedAt)) {
        decisions.set(update.leadId, { disposition: update.disposition, assessments: [assessment] })
      } else if (publishedAt === Date.parse(previous.assessments[0]!.publishedAt)) {
        previous.assessments.push(assessment)
        if (previous.disposition !== update.disposition) previous.disposition = 'unresolved'
      }
    }
  }
  return decisions
}

export function reconciledGalnetLeads(reports: SavedGalnetAnalysis[]): Set<string> {
  return new Set([...galnetLeadDecisions(reports)].filter(([, decision]) => decision.disposition !== 'unresolved').map(([id]) => id))
}
