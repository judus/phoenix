import { expect, test, vi } from 'vitest'
import { GalnetAnalysisSchema } from '@phoenix/contracts'
import { GalnetAnalysisService } from '../apps/server/src/application/galnet-analysis-service.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import type { GalnetArticleAnalyser } from '../apps/server/src/domain/galnet-analysis.js'
import { analysisArticle, analysisContent, analysisGoals, analysisUsage, savedGalnetAnalysis } from './support/galnet-analysis-fixtures.js'

function setup() {
  const db = new SqliteDatabase(':memory:')
  db.initialize()
  db.galnetArchive.observe([analysisArticle], '2026-10-07T12:00:00Z')
  const analyser = { model: 'synthetic-model', configured: () => true,
    analyse: vi.fn<GalnetArticleAnalyser['analyse']>(async () => ({ content: structuredClone(analysisContent), usage: analysisUsage })) }
  const goals = { getCurrent: vi.fn(async () => structuredClone(analysisGoals)) }
  const service = new GalnetAnalysisService(db.galnetArchive, goals, db.galnetAnalyses, analyser)
  return { db, analyser, goals, service, close: async () => { await service.stop(); db.close() } }
}

test('GET is free; manual analysis shares CG evidence, keeps references and persists a reusable report', async () => {
  const fixture = setup()
  try {
    const { service, analyser, goals } = fixture
    expect(service.get(analysisArticle.id)).toMatchObject({ analysis: null, articleAvailable: true })
    expect(analyser.analyse).not.toHaveBeenCalled()
    expect(goals.getCurrent).not.toHaveBeenCalled()
    const [first, second] = await Promise.all([service.analyse(analysisArticle.id), service.analyse(analysisArticle.id)])
    expect(first).toEqual(second)
    expect(analyser.analyse).toHaveBeenCalledTimes(1)
    expect(goals.getCurrent).toHaveBeenCalledTimes(1)
    expect(first.analysis).toMatchObject({ content: analysisContent, communityGoals: analysisGoals,
      usage: analysisUsage, sourceUrl: analysisArticle.sourceUrl, model: 'synthetic-model' })
    goals.getCurrent.mockResolvedValue({ ...analysisGoals, cache: 'fresh', fetchedAt: '2026-10-07T13:00:00Z' })
    expect((await service.analyse(analysisArticle.id)).analysis).toEqual(first.analysis)
    expect(analyser.analyse).toHaveBeenCalledTimes(1)
  } finally { await fixture.close() }
})

test('CG changes and article corrections invalidate analysis cache; changed article warning survives failure', async () => {
  const fixture = setup()
  try {
    const { service, analyser, goals, db } = fixture
    await service.analyse(analysisArticle.id)
    goals.getCurrent.mockResolvedValue({ ...analysisGoals, goals: [{ ...analysisGoals.goals[0]!, contributed: 500 }] })
    await service.analyse(analysisArticle.id)
    expect(analyser.analyse).toHaveBeenCalledTimes(2)
    db.galnetArchive.observe([{ ...analysisArticle, title: 'Corrected title' }], '2026-10-07T13:00:00Z')
    expect(service.get(analysisArticle.id).articleChanged).toBe(true)
    analyser.analyse.mockRejectedValueOnce(new Error('synthetic failure'))
    await expect(service.analyse(analysisArticle.id)).rejects.toThrow('synthetic failure')
    expect(service.get(analysisArticle.id).analysis).not.toBeNull()
    expect(service.get(analysisArticle.id).articleChanged).toBe(true)
    await service.analyse(analysisArticle.id)
    expect(service.get(analysisArticle.id).articleChanged).toBe(false)
  } finally { await fixture.close() }
})

test.each(['quote', 'unknown-goal', 'duplicate-goal', 'missing-relationship'] as const)('invalid %s cannot enter the stored report', async fault => {
  const fixture = setup()
  try {
    const content = structuredClone(analysisContent)
    if (fault === 'quote') content.facts[0]!.evidence = 'Invented statement'
    if (fault === 'unknown-goal') content.activities[0]!.communityGoalId = 'invented-id'
    if (fault === 'duplicate-goal') content.activities.push({ ...content.activities[0]! })
    if (fault === 'missing-relationship') content.activities[0]!.relationship = 'none'
    fixture.analyser.analyse.mockResolvedValue({ content, usage: analysisUsage })
    await expect(fixture.service.analyse(analysisArticle.id)).rejects.toMatchObject({ category: 'structured_output_validation' })
    expect(fixture.service.get(analysisArticle.id).analysis).toBeNull()
  } finally { await fixture.close() }
})

test('missing configuration/article and excessive input fail before AI; a CG outage is not an empty snapshot', async () => {
  const fixture = setup()
  try {
    fixture.analyser.configured = () => false
    await expect(fixture.service.analyse(analysisArticle.id)).rejects.toMatchObject({ code: 'galnet_analysis_not_configured' })
    fixture.analyser.configured = () => true
    await expect(fixture.service.analyse('missing')).rejects.toMatchObject({ code: 'galnet_article_unavailable' })
    fixture.goals.getCurrent.mockRejectedValueOnce(new Error('upstream unavailable'))
    await expect(fixture.service.analyse(analysisArticle.id)).rejects.toThrow('upstream unavailable')
    const emptyPayload = { article: { ...analysisArticle, body: '' }, communityGoals: analysisGoals }
    const oversizedArticle = { ...analysisArticle, body: 'x'.repeat(60_001 - JSON.stringify(emptyPayload).length) }
    expect(JSON.stringify({ article: oversizedArticle, communityGoals: analysisGoals }).length).toBe(60_001)
    fixture.db.galnetArchive.observe([oversizedArticle], '2026-10-07T13:00:00Z')
    await expect(fixture.service.analyse(analysisArticle.id)).rejects.toMatchObject({ code: 'galnet_analysis_input_limit' })
    expect(fixture.analyser.analyse).not.toHaveBeenCalled()
  } finally { await fixture.close() }
})

test('one manual job at a time, shutdown aborts it and late output is never persisted', async () => {
  const fixture = setup()
  let release!: () => void
  let signal!: AbortSignal
  fixture.analyser.analyse.mockImplementation(async (_article, _goals, currentSignal) => {
    signal = currentSignal
    await new Promise<void>(resolve => { release = resolve })
    return { content: analysisContent, usage: analysisUsage }
  })
  try {
    const running = fixture.service.analyse(analysisArticle.id)
    const rejected = expect(running).rejects.toThrow()
    await Promise.resolve()
    await expect(fixture.service.analyse('another')).rejects.toMatchObject({ code: 'galnet_analysis_busy' })
    const stopped = fixture.service.stop()
    expect(signal.aborted).toBe(true)
    release()
    await rejected
    await stopped
    expect(fixture.service.get(analysisArticle.id).analysis).toBeNull()
    await expect(fixture.service.analyse(analysisArticle.id)).rejects.toMatchObject({ code: 'galnet_analysis_stopped' })
  } finally { release?.(); await fixture.close() }
})

test('existing v1 evidence stays readable without calls; explicit update creates a v2 report without overwriting it', async () => {
  const fixture = setup()
  try {
    const legacy = GalnetAnalysisSchema.parse({ ...savedGalnetAnalysis(), schemaVersion: 1,
      extractorVersion: 'galnet-analysis-v1', articleRevisionId: fixture.db.galnetArchive.getArticle(analysisArticle.id)!.revisionId,
      content: { ...analysisContent, activities: analysisContent.activities.map(({ destination: _destination, ...activity }) => activity) } })
    fixture.db.galnetAnalyses.put(legacy)
    expect(fixture.service.get(analysisArticle.id).analysis).toEqual(legacy)
    expect(fixture.analyser.analyse).not.toHaveBeenCalled()
    expect((await fixture.service.analyse(analysisArticle.id)).analysis).toMatchObject({ schemaVersion: 2, extractorVersion: 'galnet-analysis-v2' })
    expect(fixture.db.galnetAnalyses.get(legacy.cacheKey)).toEqual(legacy)
    expect(fixture.analyser.analyse).toHaveBeenCalledTimes(1)
  } finally { await fixture.close() }
})

test.each(['quote', 'name', 'entity', 'partial-prefix', 'partial-suffix'] as const)('rejects destination %s mismatch before saving', async fault => {
  const fixture = setup()
  try {
    const content = structuredClone(analysisContent)
    if (fault === 'quote') content.activities[1]!.destination!.evidence = 'Colonia is a destination invented here'
    if (fault === 'name') content.activities[1]!.destination!.systemName = 'Sol'
    if (fault === 'entity') content.entities = content.entities.filter(entity => entity.name !== 'Colonia')
    if (fault === 'partial-prefix' || fault === 'partial-suffix') {
      const name = fault === 'partial-prefix' ? 'Colon' : 'lonia'
      content.activities[1]!.destination!.systemName = name
      content.entities.push({ ...content.entities.find(entity => entity.name === 'Colonia')!, name })
    }
    fixture.analyser.analyse.mockResolvedValue({ content, usage: analysisUsage })
    await expect(fixture.service.analyse(analysisArticle.id)).rejects.toMatchObject({ code: 'galnet_analysis_invalid_destination' })
    expect(fixture.service.get(analysisArticle.id).analysis).toBeNull()
  } finally { await fixture.close() }
})

test.each(['SMOJE TO-Z d13-40', 'BD+05 1295'])('accepts a fully quoted system name with literal punctuation: %s', async name => {
  const fixture = setup()
  try {
    const content = structuredClone(analysisContent)
    const activity = content.activities[1]!
    activity.evidence = activity.evidence.replace('Colonia', name)
    activity.destination = { systemName: name, evidence: activity.evidence }
    const entity = content.entities.find(entry => entry.name === 'Colonia')!
    entity.name = name
    entity.evidence = entity.evidence.replace('Colonia', name)
    fixture.db.galnetArchive.observe([{ ...analysisArticle, body: analysisArticle.body.replace('Colonia', name) }], '2026-10-08T12:00:00Z')
    fixture.analyser.analyse.mockResolvedValue({ content, usage: analysisUsage })
    expect((await fixture.service.analyse(analysisArticle.id)).analysis?.content.activities[1]).toMatchObject({ destination: { systemName: name } })
  } finally { await fixture.close() }
})
