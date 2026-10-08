import type { GalnetInvestigationLeadsResponse } from '@phoenix/contracts'
import type { SavedGalnetAnalysisReader } from '../domain/galnet-analysis.js'
import { reconciledGalnetLeads } from './galnet-lead-reconciliation.js'

/** Temporary view of saved evidence, not a catalogue or live activity registry. */
export class GalnetInvestigationLeadsService {
  public constructor (private readonly reports: Pick<SavedGalnetAnalysisReader, 'recent'>) {}

  public get (): GalnetInvestigationLeadsResponse {
    const result: GalnetInvestigationLeadsResponse = { leads: [], reportLimit: 20,
      omitted: { legacyReports: 0, changedReports: 0, endedLeads: 0, withoutDestination: 0 } }
    const recent = this.reports.recent(100)
    const reconciled = reconciledGalnetLeads(recent)
    for (const saved of recent.slice(0, result.reportLimit)) {
      const { analysis } = saved
      if (saved.articleChanged) { result.omitted.changedReports++; continue }
      if (analysis.schemaVersion === 1) { result.omitted.legacyReports++; continue }
      analysis.content.activities.forEach((activity, index) => {
        if (activity.communityGoalId !== null) return
        if (reconciled.has(`galnet-lead:${analysis.cacheKey}:${index}`)) return
        if (activity.status === 'ended') { result.omitted.endedLeads++; return }
        if (!activity.destination) { result.omitted.withoutDestination++; return }
        result.leads.push({ id: `galnet-lead:${analysis.cacheKey}:${index}`, articleId: analysis.articleId,
          articleRevisionId: analysis.articleRevisionId, articleTitle: saved.currentArticleTitle,
          sourceUrl: analysis.sourceUrl, publishedAt: analysis.publishedAt, analysedAt: analysis.analysedAt,
          model: analysis.model, title: activity.title, action: activity.action, evidence: activity.evidence,
          status: activity.status, systemName: activity.destination.systemName, destinationEvidence: activity.destination.evidence })
      })
    }
    return result
  }
}
