import { expect, test, vi } from 'vitest'
import type { GalnetAnalysis, GalnetContinuity } from '@phoenix/contracts'
import type { SavedGalnetAnalysis } from '../apps/server/src/domain/galnet-analysis.js'
import { galnetLeadDecisions } from '../apps/server/src/application/galnet-lead-reconciliation.js'
import { GalnetInvestigationLeadsService } from '../apps/server/src/application/galnet-investigation-leads-service.js'
import { CommsGetGalnetAnalysisTool, CommsListGalnetAnalysesTool } from '../apps/server/src/application/mcp-tools/comms-galnet-analysis-tools.js'
import { savedGalnetAnalysis } from './support/galnet-analysis-fixtures.js'

function fixture() {
  const report = savedGalnetAnalysis()
  const activity = report.content.activities[1]!
  report.content.activities = [{ ...activity, title: 'Find the ship' },
    { ...activity, title: 'Investigate an unlocated beacon', destination: null },
    { ...activity, title: 'Ended appeal', status: 'ended' }, report.content.activities[0]!]
  const prior: SavedGalnetAnalysis & { analysis: typeof report } = {
    analysis: report, currentArticleTitle: 'Earlier coverage', articleChanged: false, contextChanged: false }
  const later: SavedGalnetAnalysis & { analysis: Extract<GalnetAnalysis, { schemaVersion: 3 }> } = {
    articleChanged: false, contextChanged: false, currentArticleTitle: 'Later coverage',
    analysis: { ...savedGalnetAnalysis(), schemaVersion: 3, extractorVersion: 'galnet-analysis-v3',
      articleId: 'later', cacheKey: 'later-cache', publishedAt: '2026-10-02T12:00:00Z',
      analysedAt: '2026-10-08T12:00:00Z', sourceUrl: 'https://example.com/galnet/later',
      content: { summary: 'The ship was found.', facts: [], interpretations: [], entities: [], activities: [] },
      context: [{ articleId: report.articleId, articleRevisionId: report.articleRevisionId, analysisCacheKey: report.cacheKey,
        title: 'Earlier coverage', sourceUrl: report.sourceUrl, publishedAt: report.publishedAt, communityGoals: report.communityGoals }],
      continuity: { summary: 'The ship was found, not the separate beacon.', relatedArticleIds: [report.articleId],
        developments: [{ text: 'The ship was found.', evidence: { articleId: 'later', quote: 'The ship was found.' } }],
        updates: [{ leadId: `galnet-lead:${report.cacheKey}:0`, disposition: 'resolved', explanation: 'The search concluded.',
          evidence: { articleId: 'later', quote: 'The ship was found.' }, replacementActivityIndex: null, communityGoalId: null }] }
    } }
  let reports: SavedGalnetAnalysis[] = [later, prior]
  const reader = { recent: vi.fn(() => reports), get: vi.fn((id: string) => reports.find(entry => entry.analysis.articleId === id) ?? null) }
  return { prior, later, reader, list: new CommsListGalnetAnalysesTool(reader), detail: new CommsGetGalnetAnalysisTool(reader),
    atlas: new GalnetInvestigationLeadsService(reader), setReports: (next: SavedGalnetAnalysis[]) => { reports = next } }
}

test('current counts and leads share Atlas decisions but retain leads without a destination', () => {
  const f = fixture()
  expect(f.list.execute({}).structuredContent).toMatchObject({ reports: [{ articleId: 'later', currentInvestigationLeadCount: 0 },
    { articleId: f.prior.analysis.articleId, originalInvestigationLeadCount: 3, currentInvestigationLeadCount: 1 }] })
  expect(f.detail.execute({ articleId: f.prior.analysis.articleId }).structuredContent).toMatchObject({
    reconciliationReportLimit: 100, currentInvestigationLeads: [{ title: 'Investigate an unlocated beacon', destination: null, status: 'unknown' }],
    leadAssessments: [{ leadId: `galnet-lead:${f.prior.analysis.cacheKey}:0`, disposition: 'resolved', assessments: [{
      articleId: 'later', sourceUrl: f.later.analysis.sourceUrl, publishedAt: f.later.analysis.publishedAt,
      analysedAt: f.later.analysis.analysedAt, analysisCacheKey: f.later.analysis.cacheKey, model: f.later.analysis.model,
      evidenceSourceUrl: f.later.analysis.sourceUrl, update: { explanation: 'The search concluded.', evidence: { quote: 'The ship was found.' } }
    }] }], report: { content: f.prior.analysis.content }
  })
  expect(f.atlas.get().leads).toEqual([]) // Remaining lead has no destination, not no activity.
  expect(f.reader.recent).toHaveBeenLastCalledWith(100)
})

test('summary limits do not shrink the evidence window; detail can select a retained report outside it', () => {
  const f = fixture()
  f.setReports([f.prior, f.later])
  expect(f.list.execute({ limit: 1 }).structuredContent).toMatchObject({ reports: [{ currentInvestigationLeadCount: 1 }] })
  f.setReports([f.later])
  f.reader.get.mockReturnValue(f.prior)
  expect(f.detail.execute({ articleId: f.prior.analysis.articleId }).structuredContent).toMatchObject({
    currentInvestigationLeads: [{ title: 'Investigate an unlocated beacon' }], leadAssessments: [{ disposition: 'resolved' }]
  })
})

test('assessment evidence links to its quoted context source, not automatically the reporting article', () => {
  const f = fixture()
  const proof: SavedGalnetAnalysis = { ...f.prior, analysis: { ...savedGalnetAnalysis(),
    articleId: 'proof', cacheKey: 'proof-cache', sourceUrl: 'https://example.com/galnet/proof',
    publishedAt: '2026-10-02T10:00:00Z', content: { ...savedGalnetAnalysis().content, activities: [] } } }
  f.later.analysis.context.push({ articleId: 'proof', articleRevisionId: proof.analysis.articleRevisionId,
    analysisCacheKey: proof.analysis.cacheKey, title: 'Proof', sourceUrl: proof.analysis.sourceUrl,
    publishedAt: proof.analysis.publishedAt, communityGoals: proof.analysis.communityGoals })
  f.later.analysis.continuity!.updates[0]!.evidence.articleId = 'proof'
  f.later.analysis.continuity!.relatedArticleIds.push('proof')
  f.setReports([f.later, proof, f.prior])
  expect(f.detail.execute({ articleId: f.prior.analysis.articleId }).structuredContent).toMatchObject({
    leadAssessments: [{ assessments: [{ articleId: 'later', sourceUrl: f.later.analysis.sourceUrl,
      evidenceSourceUrl: proof.analysis.sourceUrl, update: { evidence: { articleId: 'proof' } } }] }]
  })
})

test.each(['articleChanged', 'contextChanged'] as const)('a later assessment with %s does not retire the earlier lead', flag => {
  const f = fixture()
  f.later[flag] = true
  expect(f.detail.execute({ articleId: f.prior.analysis.articleId }).structuredContent).toMatchObject({
    currentInvestigationLeads: [{ title: 'Find the ship' }, { title: 'Investigate an unlocated beacon' }], leadAssessments: []
  })
  expect(f.atlas.get().leads.map(lead => lead.title)).toEqual(['Find the ship'])
})

test('changed anchors are unknown, not zero; original evidence remains readable', () => {
  const f = fixture()
  f.prior.articleChanged = true
  expect(f.list.execute({}).structuredContent).toMatchObject({ reports: [{}, { currentInvestigationLeadCount: null, originalInvestigationLeadCount: 3 }] })
  expect(f.detail.execute({ articleId: f.prior.analysis.articleId }).structuredContent).toMatchObject({
    currentInvestigationLeads: null, leadAssessments: [], report: { content: f.prior.analysis.content }
  })
})

test('a newly selected earlier report invalidates assessments of its previous immutable leads', () => {
  const f = fixture()
  f.prior.analysis = { ...f.prior.analysis, cacheKey: 'new-selected-report' }
  expect(f.detail.execute({ articleId: f.prior.analysis.articleId }).structuredContent).toMatchObject({
    currentInvestigationLeads: [{ title: 'Find the ship' }, { title: 'Investigate an unlocated beacon' }], leadAssessments: []
  })
  expect(f.atlas.get().leads.map(lead => lead.title)).toEqual(['Find the ship'])
})

test('equal-date conflicting dispositions retain the lead and both source assessments regardless of order', () => {
  const f = fixture()
  const alternative: SavedGalnetAnalysis = { ...f.later, analysis: { ...f.later.analysis,
    articleId: 'alternative', cacheKey: 'alternative-cache', sourceUrl: 'https://example.com/galnet/alternative',
    continuity: { ...f.later.analysis.continuity!,
      developments: [{ text: 'Conflicting report.', evidence: { articleId: 'alternative', quote: 'The ship was found.' } }],
      updates: f.later.analysis.continuity!.updates.map(update => ({ ...update, disposition: 'unresolved',
        evidence: { ...update.evidence, articleId: 'alternative' } })) } } }
  for (const reports of [[f.later, alternative, f.prior], [alternative, f.prior, f.later]]) {
    f.setReports(reports)
    const decision = galnetLeadDecisions(reports).get(`galnet-lead:${f.prior.analysis.cacheKey}:0`)!
    expect(decision.disposition).toBe('unresolved')
    expect(decision.assessments.map(assessment => assessment.articleId).sort()).toEqual(['alternative', 'later'])
    expect(f.detail.execute({ articleId: f.prior.analysis.articleId }).structuredContent).toMatchObject({
      currentInvestigationLeads: [{ title: 'Find the ship' }, { title: 'Investigate an unlocated beacon' }],
      leadAssessments: [{ disposition: 'unresolved' }]
    })
    expect(f.atlas.get().leads.map(lead => lead.title)).toEqual(['Find the ship'])
  }
})

test.each(['unresolved', 'superseded', 'community-goal'] as const)('latest publication assessment %s determines remaining leads, not analysis time', disposition => {
  const f = fixture()
  const later = f.later.analysis
  const update: GalnetContinuity['updates'][number] = { ...later.continuity!.updates[0]!, disposition,
    replacementActivityIndex: disposition === 'superseded' ? 0 : null,
    communityGoalId: disposition === 'community-goal' ? 'cg-research' : null,
    evidence: { articleId: 'newest', quote: 'Newer explicit evidence.' } }
  const newest: GalnetAnalysis = { ...later, articleId: 'newest', cacheKey: 'newest-cache', publishedAt: '2026-10-03T12:00:00Z',
    analysedAt: '2026-10-07T13:00:00Z', sourceUrl: 'https://example.com/galnet/newest',
    content: { ...later.content, activities: disposition === 'superseded' ? [f.prior.analysis.content.activities[1]!] : [] },
    continuity: { ...later.continuity!,
      developments: [{ text: 'Newer explicit evidence.', evidence: { articleId: 'newest', quote: 'Newer explicit evidence.' } }],
      updates: [update] } }
  f.setReports([f.later, { ...f.later, analysis: newest }, f.prior])
  const expected = disposition === 'unresolved' ? ['Find the ship', 'Investigate an unlocated beacon'] : ['Investigate an unlocated beacon']
  const detail = f.detail.execute({ articleId: f.prior.analysis.articleId })
  expect(detail.structuredContent).toMatchObject({ currentInvestigationLeads: expected.map(title => ({ title })),
    leadAssessments: [{ disposition, assessments: [{ articleId: 'newest', update: { replacementActivityIndex: update.replacementActivityIndex,
      communityGoalId: update.communityGoalId } }] }] })
})
