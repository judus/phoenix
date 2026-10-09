import { expect, test, vi } from 'vitest'
import type { GalnetContinuity, GalnetAnalysisContent } from '@phoenix/contracts'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { GalnetAnalysisService } from '../apps/server/src/application/galnet-analysis-service.js'
import { SavedGalnetAnalysisService } from '../apps/server/src/application/saved-galnet-analysis-service.js'
import { GalnetInvestigationLeadsService } from '../apps/server/src/application/galnet-investigation-leads-service.js'
import { galnetStoryContext } from '../apps/server/src/application/galnet-story-context.js'
import { CommsGetGalnetAnalysisTool } from '../apps/server/src/application/mcp-tools/comms-galnet-analysis-tools.js'
import type { GalnetArticleAnalyser } from '../apps/server/src/domain/galnet-analysis.js'
import { analysisArticle, analysisGoals, analysisUsage, savedGalnetAnalysis } from './support/galnet-analysis-fixtures.js'

function setup() {
  const db = new SqliteDatabase(':memory:'); db.initialize()
  const missing = { ...analysisArticle, id: 'missing', title: 'EVE-597 missing', publishedAt: '2026-09-17T12:00:00Z',
    body: 'EVE-597 is missing in Sol. Decode the beacon in Sol.' }
  const found = { ...analysisArticle, id: 'found', title: 'EVE-597 located', publishedAt: '2026-09-22T12:00:00Z',
    body: 'EVE-597 has been found in Sol. Pilots are asked to fight attackers in Sol.' }
  db.galnetArchive.observe([missing, found], '2026-10-08T12:00:00Z')
  const entities = [{ name: 'EVE-597', kind: 'ship' as const, role: 'Story subject', evidence: 'EVE-597' },
    { name: 'Sol', kind: 'system' as const, role: 'Destination', evidence: 'Sol' }]
  const prior = savedGalnetAnalysis({ cacheKey: 'older', articleId: missing.id, publishedAt: missing.publishedAt,
    articleRevisionId: db.galnetArchive.getArticle(missing.id)!.revisionId, analysedAt: '2026-10-07T12:00:00Z',
    content: { summary: 'A missing ship and a separate beacon.', facts: [], interpretations: [], entities,
      activities: ['EVE-597 is missing in Sol.', 'Decode the beacon in Sol.'].map((evidence, index) => ({
        title: index === 0 ? 'Find the ship' : 'Decode beacon', action: evidence, evidence, status: 'unknown',
        communityGoalId: null, relationship: 'none', destination: { systemName: 'Sol', evidence }
      })) } })
  db.galnetAnalyses.put(prior)
  const content: GalnetAnalysisContent = { summary: 'The ship was found; a later combat appeal is separate.',
    facts: [{ text: 'The ship was found.', evidence: 'EVE-597 has been found in Sol.' }], interpretations: [], entities,
    activities: [{ title: 'Fight attackers', action: 'See the reported combat appeal.', evidence: 'Pilots are asked to fight attackers in Sol.',
      status: 'unknown', communityGoalId: null, relationship: 'none', destination: { systemName: 'Sol', evidence: 'fight attackers in Sol' } }] }
  const continuity: GalnetContinuity = { summary: 'The search concluded; the beacon and combat appeal remain separate.',
    relatedArticleIds: ['missing'], developments: [{ text: 'The missing ship was located.',
      evidence: { articleId: 'found', quote: 'EVE-597 has been found in Sol.' } }],
    updates: [{ leadId: 'galnet-lead:older:0', disposition: 'resolved', explanation: 'The ship was located, ending that search.',
      evidence: { articleId: 'found', quote: 'EVE-597 has been found in Sol.' }, replacementActivityIndex: null, communityGoalId: null }] }
  const analyser = { model: 'synthetic', configured: () => true,
    analyse: vi.fn<GalnetArticleAnalyser['analyse']>(async () => ({ content: structuredClone(content), continuity: structuredClone(continuity), usage: analysisUsage })) }
  const goals = { getCurrent: vi.fn(async () => structuredClone(analysisGoals)) }
  const service = new GalnetAnalysisService(db.galnetArchive, goals, db.galnetAnalyses, analyser,
    () => new Date('2026-10-10T12:00:00Z'))
  const saved = new SavedGalnetAnalysisService(db.galnetAnalyses, db.galnetArchive)
  const atlas = new GalnetInvestigationLeadsService(saved)
  return { db, missing, found, prior, content, continuity, analyser, goals, service, saved, atlas,
    close: async () => { await service.stop(); db.close() } }
}

test('one request combines original sources; only the explicitly resolved lead leaves the Atlas', async () => {
  const f = setup()
  try {
    expect(f.service.get('found').analysis).toBeNull()
    expect(f.atlas.get().leads.map(lead => lead.title)).toEqual(['Find the ship', 'Decode beacon'])
    const result = await f.service.analyse('found')
    expect(result.analysis).toMatchObject({ schemaVersion: 3, continuity: f.continuity,
      context: [{ articleId: 'missing', analysisCacheKey: 'older', articleRevisionId: f.prior.articleRevisionId }] })
    expect(f.analyser.analyse.mock.calls[0]![3][0]).toMatchObject({ article: f.missing,
      activities: [{ leadId: 'galnet-lead:older:0' }, { leadId: 'galnet-lead:older:1' }] })
    expect(f.atlas.get().leads.map(lead => lead.title)).toEqual(['Fight attackers', 'Decode beacon'])
    expect(f.db.galnetAnalyses.get('older')).toEqual(f.prior)
    await f.service.analyse('found')
    const detail = new CommsGetGalnetAnalysisTool(f.saved).execute({ articleId: 'found' })
    expect(detail.structuredContent).toMatchObject({ contextChanged: false, report: { continuity: f.continuity } })
    expect(f.analyser.analyse).toHaveBeenCalledTimes(1)
  } finally { await f.close() }
})

test.each(['unrelated', 'omitted', 'uncertain'] as const)('%s continuity never silently retires prior leads', async mode => {
  const f = setup()
  try {
    const continuity = mode === 'unrelated' ? null : { ...f.continuity, updates: mode === 'omitted' ? []
      : f.continuity.updates.map(update => ({ ...update, disposition: 'unresolved' as const })) }
    f.analyser.analyse.mockResolvedValue({ content: f.content, continuity, usage: analysisUsage })
    await f.service.analyse('found')
    expect(f.atlas.get().leads.map(lead => lead.title)).toContain('Find the ship')
    expect(f.atlas.get().leads.map(lead => lead.title)).toContain('Decode beacon')
  } finally { await f.close() }
})

test.each(['quote', 'article', 'lead', 'duplicate', 'earlier-evidence', 'replacement', 'campaign'] as const)
('invalid continuity %s preserves the prior valid report with no automatic retry', async fault => {
  const f = setup()
  try {
    const original = (await f.service.analyse('found')).analysis
    const continuity = structuredClone(f.continuity)
    const update = continuity.updates[0]!
    if (fault === 'quote') update.evidence.quote = 'Invented resolution'
    if (fault === 'article') continuity.relatedArticleIds = ['unknown']
    if (fault === 'lead') update.leadId = 'unknown'
    if (fault === 'duplicate') continuity.updates.push(structuredClone(update))
    if (fault === 'earlier-evidence') update.evidence = { articleId: 'missing', quote: 'EVE-597 is missing in Sol.' }
    if (fault === 'replacement') update.disposition = 'superseded'
    if (fault === 'campaign') { update.disposition = 'community-goal'; update.communityGoalId = 'invented' }
    f.goals.getCurrent.mockResolvedValue({ ...analysisGoals, goals: analysisGoals.goals.map(goal => ({ ...goal, briefing: 'Changed input' })) })
    f.analyser.analyse.mockResolvedValue({ content: f.content, continuity, usage: analysisUsage })
    await expect(f.service.analyse('found')).rejects.toMatchObject({ code: 'galnet_analysis_invalid_continuity' })
    expect(f.service.get('found').analysis).toEqual(original)
    expect(f.analyser.analyse).toHaveBeenCalledTimes(2)
  } finally { await f.close() }
})

test('an explicitly identified replacement retires only its particular predecessor', async () => {
  const f = setup()
  try {
    f.continuity.updates[0]!.disposition = 'superseded'
    f.continuity.updates[0]!.replacementActivityIndex = 0
    await f.service.analyse('found')
    expect(f.atlas.get().leads.map(lead => lead.title)).toEqual(['Fight attackers', 'Decode beacon'])
  } finally { await f.close() }
})

test('story quotes remove added wrappers and restore original source formatting', async () => {
  const f = setup()
  try {
    f.db.galnetArchive.observe([{ ...f.found, body: f.found.body.replace('has been', 'has\r\nbeen') }], '2026-10-09T12:00:00Z')
    f.continuity.developments[0]!.evidence.quote = '“EVE-597 has been found in Sol.”'
    f.continuity.updates[0]!.evidence.quote = '"EVE-597 has been found in Sol."'
    const result = await f.service.analyse('found')
    expect(result.analysis?.schemaVersion === 3 && result.analysis.continuity?.developments[0]?.evidence.quote)
      .toBe('EVE-597 has\r\nbeen found in Sol.')
    expect(result.analysis?.schemaVersion === 3 && result.analysis.continuity?.updates[0]?.evidence.quote)
      .toBe('EVE-597 has\r\nbeen found in Sol.')
  } finally { await f.close() }
})

test('historical CG references remain dated and reconcile leads without manufacturing a new campaign', async () => {
  const f = setup()
  try {
    const historic = { ...analysisGoals.goals[0]!, id: 'historic-cg' }
    const report = { ...f.prior, communityGoals: { ...analysisGoals, fetchedAt: '2026-09-17T12:00:00Z', goals: [historic] },
      cacheKey: 'historical', analysedAt: '2026-10-08T12:00:00Z' }
    report.content = structuredClone(f.prior.content)
    report.content.activities.push({ ...report.content.activities[0]!, title: 'Historical campaign', communityGoalId: historic.id, relationship: 'explicit' })
    f.db.galnetAnalyses.put(report)
    f.continuity.updates[0] = { ...f.continuity.updates[0]!, leadId: 'galnet-lead:historical:0', disposition: 'community-goal', communityGoalId: historic.id }
    const result = await f.service.analyse('found')
    expect(result.analysis?.schemaVersion === 3 && result.analysis.context[0]!.communityGoals).toMatchObject({
      fetchedAt: '2026-09-17T12:00:00Z', goals: [{ id: historic.id }] })
    expect(result.analysis!.communityGoals.goals.some(goal => goal.id === historic.id)).toBe(false)
    expect(f.atlas.get().leads.map(lead => lead.title)).toEqual(['Fight attackers', 'Decode beacon'])
    expect(new CommsGetGalnetAnalysisTool(f.saved).execute({ articleId: 'found' }).structuredContent)
      .toMatchObject({ report: { context: [{ communityGoals: { goals: [{ id: historic.id }] } }] } })
  } finally { await f.close() }
})

test.each([true, false])('context offers only independent leads without renumbering their original indices: mixed=%s', async mixed => {
  const f = setup()
  try {
    const report = structuredClone(f.prior)
    report.content.activities = [{ ...report.content.activities[0]!, communityGoalId: analysisGoals.goals[0]!.id,
      relationship: 'explicit' }, ...(mixed ? [report.content.activities[1]!] : [])]
    f.db.galnetAnalyses.put({ ...report, cacheKey: 'campaign-context', analysedAt: '2026-10-08T12:00:00Z' })
    const context = galnetStoryContext(f.db.galnetArchive.getArticle('found')!, f.db.galnetArchive, f.db.galnetAnalyses)
    expect(context[0]!.activities.map(activity => activity.leadId))
      .toEqual(mixed ? ['galnet-lead:campaign-context:1'] : [])
    expect(context[0]!.source.communityGoals.goals.map(goal => goal.id)).toEqual([analysisGoals.goals[0]!.id])
    f.continuity.updates = []
    const result = await f.service.analyse('found')
    expect(result.analysis?.schemaVersion === 3 && result.analysis.continuity?.summary).toBe(f.continuity.summary)
    expect(f.analyser.analyse.mock.calls[0]![3][0]!.activities).toEqual(context[0]!.activities)
  } finally { await f.close() }
})

test('corrected source evidence stops reconciliation; changed related context is visibly flagged', async () => {
  const f = setup()
  try {
    await f.service.analyse('found')
    f.db.galnetArchive.observe([{ ...f.found, title: 'Correction' }], '2026-10-09T12:00:00Z')
    expect(f.atlas.get().leads.map(lead => lead.title)).toContain('Find the ship')
    f.db.galnetArchive.observe([{ ...f.missing, title: 'Earlier correction' }], '2026-10-09T12:00:00Z')
    expect(f.service.get('found').contextChanged).toBe(true)
    expect(f.saved.get('found')?.contextChanged).toBe(true)
  } finally { await f.close() }
})

test('equal-date conflicting assessments keep the prior lead rather than choosing analysis/insertion order', async () => {
  const f = setup()
  try {
    const report = (await f.service.analyse('found')).analysis!
    if (report.schemaVersion !== 3) throw new Error('Expected v3')
    const other = { ...f.found, id: 'alternative', sourceUrl: 'https://example.com/galnet/alternative' }
    f.db.galnetArchive.observe([other], '2026-10-08T12:00:00Z')
    f.db.galnetAnalyses.put({ ...report, articleId: other.id, articleRevisionId: f.db.galnetArchive.getArticle(other.id)!.revisionId,
      cacheKey: 'alternative', sourceUrl: other.sourceUrl, continuity: { ...f.continuity,
        developments: f.continuity.developments.map(development => ({ ...development,
          evidence: { ...development.evidence, articleId: other.id } })),
        updates: f.continuity.updates.map(update => ({ ...update, disposition: 'unresolved',
          evidence: { ...update.evidence, articleId: other.id } })) } })
    expect(f.atlas.get().leads.map(lead => lead.title)).toContain('Find the ship')
  } finally { await f.close() }
})

test('candidate selection is bounded, publication-ordered and excludes partial names/future/corrected sources', () => {
  const f = setup()
  try {
    for (let index = 0; index < 7; index++) {
      const article = { ...f.missing, id: `prior-${index}`, publishedAt: `2026-09-${String(10 + index).padStart(2, '0')}T12:00:00Z` }
      f.db.galnetArchive.observe([article], '2026-10-08T12:00:00Z')
      f.db.galnetAnalyses.put({ ...f.prior, articleId: article.id, cacheKey: article.id, publishedAt: article.publishedAt,
        articleRevisionId: f.db.galnetArchive.getArticle(article.id)!.revisionId })
    }
    const revision = f.db.galnetArchive.getArticle('found')!
    const context = galnetStoryContext(revision, f.db.galnetArchive, f.db.galnetAnalyses)
    expect(context.map(entry => entry.source.articleId)).toEqual(['missing', 'prior-6', 'prior-5', 'prior-4', 'prior-3'])
    expect(galnetStoryContext({ ...revision, article: { ...revision.article, title: 'Unrelated', body: 'EVE-5970 in Sol.' } }, f.db.galnetArchive, f.db.galnetAnalyses)).toEqual([])
    expect(galnetStoryContext({ ...revision, article: { ...revision.article, publishedAt: '2026-09-01T12:00:00Z' } }, f.db.galnetArchive, f.db.galnetAnalyses)).toEqual([])
    f.db.galnetArchive.observe([{ ...f.missing, title: 'Corrected' }], '2026-10-09T12:00:00Z')
    expect(galnetStoryContext(revision, f.db.galnetArchive, f.db.galnetAnalyses).map(entry => entry.source.articleId))
      .toEqual(['prior-6', 'prior-5', 'prior-4', 'prior-3', 'prior-2'])
  } finally { f.db.close() }
})

test('related source identities participate in caching; oversized combined input fails before inference', async () => {
  const f = setup()
  try {
    await f.service.analyse('found')
    f.db.galnetAnalyses.put({ ...f.prior, cacheKey: 'updated-prior', analysedAt: '2026-10-08T12:00:00Z' })
    expect(f.service.get('found').contextChanged).toBe(true)
    expect(f.atlas.get().leads.map(lead => lead.title)).toContain('Find the ship')
    f.analyser.analyse.mockResolvedValue({ content: f.content, continuity: null, usage: analysisUsage })
    await f.service.analyse('found')
    expect(f.analyser.analyse).toHaveBeenCalledTimes(2)
    expect(f.service.get('found').contextChanged).toBe(false)
    const oversized = { ...f.missing, body: f.missing.body + 'x'.repeat(60_001) }
    f.db.galnetArchive.observe([oversized], '2026-10-08T13:00:00Z')
    f.db.galnetAnalyses.put({ ...f.prior, cacheKey: 'oversized', analysedAt: '2026-10-08T13:00:00Z',
      articleRevisionId: f.db.galnetArchive.getArticle('missing')!.revisionId })
    await expect(f.service.analyse('found')).rejects.toMatchObject({ code: 'galnet_analysis_input_limit' })
    expect(f.analyser.analyse).toHaveBeenCalledTimes(2)
  } finally { await f.close() }
})
