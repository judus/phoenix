import { expect, test, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { GalnetBackgroundService } from '../apps/server/src/application/galnet-background-service.js'
import { GalnetAnalysisService } from '../apps/server/src/application/galnet-analysis-service.js'
import { SavedGalnetAnalysisService } from '../apps/server/src/application/saved-galnet-analysis-service.js'
import type { GalnetArticleAnalyser } from '../apps/server/src/domain/galnet-analysis.js'
import { analysisArticle, analysisContent, analysisGoals, analysisUsage } from './support/galnet-analysis-fixtures.js'

function fixture() {
  const db = new SqliteDatabase(':memory:')
  db.initialize()
  let clock = new Date('2026-10-07T12:00:00Z')
  db.galnetBackground.save({ ...db.galnetBackground.load(), installedAt: clock.toISOString() })
  let articles = [analysisArticle]
  let goals = structuredClone(analysisGoals)
  const now = () => clock
  const analyser = { model: 'synthetic-model', configured: () => true,
    analyse: vi.fn<GalnetArticleAnalyser['analyse']>(async () => ({ content: structuredClone(analysisContent), continuity: null, usage: analysisUsage })) }
  const goalReader = { getCurrent: vi.fn(async () => goals) }
  const news = { getLatest: vi.fn(async () => {
    db.galnetArchive.observe(articles, now().toISOString())
    return { articles, fetchedAt: now().toISOString(), cache: 'refreshed' as const }
  }) }
  const analysis = new GalnetAnalysisService(db.galnetArchive, goalReader, db.galnetAnalyses, analyser, now)
  const saved = new SavedGalnetAnalysisService(db.galnetAnalyses, db.galnetArchive)
  let configured = true
  const worker = new GalnetBackgroundService(db.galnetBackground, news, goalReader, db.galnetArchive, saved, analysis, () => configured, now)
  const add = () => { articles = [...articles, { ...analysisArticle, id: 'new-article', publishedAt: '2026-10-07T12:10:00Z' }] }
  return { db, worker, analyser, analysis, news, goalReader,
    enable: () => worker.setSettings({ enabled: true, dailyLimit: 10 }), add,
    advance: (minutes = 16) => { clock = new Date(clock.getTime() + minutes * 60_000) },
    goals: (next: typeof goals) => { goals = next },
    configured: (value: boolean) => { configured = value },
    revise: () => { articles = articles.map(article => ({ ...article, title: `${article.title} revised` })) },
    close: async () => { await Promise.all([worker.stop(), analysis.stop()]); db.close() }
  }
}

function storyFixture() {
  const f = fixture()
  const articles = ['earlier', 'middle', 'later'].map((id, index) => ({ ...analysisArticle, id,
    title: `EVE-597 report ${index}`, body: 'EVE-597 needs investigation.',
    publishedAt: `2026-09-${10 + index}T12:00:00Z` }))
  f.db.galnetArchive.observe(articles, '2026-10-07T12:00:00Z')
  f.analyser.analyse.mockImplementation(async article => ({ content: {
    summary: article.article.title, facts: [], interpretations: [], activities: [],
    entities: article.article.body.includes('EVE-597')
      ? [{ name: 'EVE-597', kind: 'ship', role: 'Subject', evidence: 'EVE-597' }] : []
  }, continuity: null, usage: analysisUsage }))
  return { ...f, articles }
}

test('late earlier analysis refreshes an existing newer report once without analysing uncovered history', async () => {
  const f = storyFixture()
  try {
    await f.analysis.analyse('later')
    await f.analysis.analyse('earlier')
    const earlier = f.db.galnetAnalyses.latest('earlier')!
    f.enable(); await f.worker.tick()
    expect(f.analyser.analyse.mock.calls.map(call => call[0].article.id)).toEqual(['later', 'earlier', 'later'])
    expect(f.db.galnetAnalyses.latest('later')).toMatchObject({ context: [{ analysisCacheKey: earlier.cacheKey }] })
    expect(f.worker.status().jobs).toMatchObject([{ reason: 'story-context', state: 'succeeded' }])
    f.advance(); await f.worker.tick(); f.db.initialize(); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(3)
    expect(f.db.galnetAnalyses.latest('middle')).toBeNull()
  } finally { await f.close() }
})

test('changed earlier evidence refreshes dependencies oldest first, then stops', async () => {
  const f = storyFixture()
  try {
    for (const article of f.articles) await f.analysis.analyse(article.id)
    const old = f.db.galnetAnalyses.latest('earlier')!
    f.db.galnetArchive.observe([{ ...f.articles[0]!, title: 'Corrected EVE-597 report' }], '2026-10-07T13:00:00Z')
    f.enable(); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(3) // Wait for the corrected earlier report.
    f.worker.catchUp(['earlier']); await f.worker.tick()
    expect(f.analyser.analyse.mock.calls.map(call => call[0].article.id)).toEqual([
      'earlier', 'middle', 'later', 'earlier', 'middle', 'later'
    ])
    expect(f.db.galnetAnalyses.get(old.cacheKey)).toEqual(old)
    expect(f.analysis.get('middle').contextChanged).toBe(false)
    expect(f.analysis.get('later').contextChanged).toBe(false)
    await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(6)
  } finally { await f.close() }
})

test('failed story refresh does not retry unchanged evidence or refresh downstream against stale context', async () => {
  const f = storyFixture()
  try {
    for (const article of f.articles) await f.analysis.analyse(article.id)
    f.db.galnetArchive.observe([{ ...f.articles[0]!, title: 'Corrected EVE-597 report' }], '2026-10-07T13:00:00Z')
    await f.analysis.analyse('earlier')
    f.analyser.analyse.mockRejectedValueOnce(new Error('Synthetic refresh failure'))
    f.enable(); await f.worker.tick()
    expect(f.worker.status().jobs).toMatchObject([{ articleId: 'middle', state: 'failed', reason: 'story-context' }])
    f.db.initialize(); f.advance(); await f.worker.tick(); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(5)
    // An explicit successful retry releases its newer dependent; no worker retry loop.
    expect(f.worker.status().backlog.map(article => article.articleId)).toContain('middle')
    f.worker.catchUp(['middle']); await f.worker.tick()
    expect(f.analyser.analyse.mock.calls.slice(-2).map(call => call[0].article.id)).toEqual(['middle', 'later'])
  } finally { await f.close() }
})

test('story refresh needs background consent and obeys the existing UTC allowance', async () => {
  const f = storyFixture()
  try {
    await f.analysis.analyse('later'); await f.analysis.analyse('earlier')
    await f.worker.tick()
    expect(f.worker.status().jobs).toEqual([])
    // Consume today's queue allowance with explicit work, then turn automatic refresh on.
    f.worker.catchUp(['middle']); await f.worker.tick()
    f.worker.setSettings({ enabled: true, dailyLimit: 1 }); await f.worker.tick()
    expect(f.worker.status()).toMatchObject({ requestsToday: 1, pending: 1 })
    f.worker.setSettings({ enabled: false, dailyLimit: 1 }); f.advance(24 * 60)
    await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(3)
    f.enable(); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(4)
  } finally { await f.close() }
})

test('a failed catch-up prerequisite leaves dependents pending, allows unrelated work, and releases them after retry', async () => {
  const f = storyFixture()
  try {
    for (const article of f.articles) await f.analysis.analyse(article.id)
    f.db.galnetArchive.observe([{ ...f.articles[0]!, title: 'Corrected EVE-597 report' },
      { ...analysisArticle, id: 'unrelated', publishedAt: '2026-09-14T12:00:00Z', body: 'Independent news.' }
    ], '2026-10-07T13:00:00Z')
    f.worker.catchUp(['later', 'middle', 'earlier', 'unrelated'])
    f.analyser.analyse.mockRejectedValueOnce(new Error('Synthetic prerequisite failure'))
    await f.worker.tick()
    expect(f.analyser.analyse.mock.calls.slice(3).map(call => call[0].article.id)).toEqual(['earlier', 'unrelated'])
    expect(f.db.galnetBackground.list('pending').map(job => job.articleId)).toEqual(['middle', 'later'])
    expect(f.worker.status()).toMatchObject({ enabled: false, requestsToday: 2, pending: 2 })
    f.db.initialize(); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(5)
    f.worker.catchUp(['earlier']); await f.worker.tick()
    expect(f.analyser.analyse.mock.calls.slice(-3).map(call => call[0].article.id)).toEqual(['earlier', 'middle', 'later'])
    expect(f.worker.status()).toMatchObject({ pending: 0, requestsToday: 5 })
    expect(f.analysis.get('later').contextChanged).toBe(false)
  } finally { await f.close() }
})

test('returning to an earlier cached context selects it for subsequent reads without inference', async () => {
  const f = storyFixture()
  try {
    const original = (await f.analysis.analyse('later')).analysis!
    await f.analysis.analyse('earlier')
    f.enable(); await f.worker.tick()
    expect(f.db.galnetAnalyses.latest('later')?.cacheKey).not.toBe(original.cacheKey)
    f.db.galnetArchive.observe([{ ...f.articles[0]!, body: 'No named subject.' }], '2026-10-07T13:00:00Z')
    await f.analysis.analyse('earlier'); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(4)
    expect(f.analysis.get('later').analysis).toEqual(original)
    expect(f.db.galnetAnalyses.recent(100)).toContainEqual(original)
    f.db.initialize(); await f.worker.tick()
    expect(f.analysis.get('later').analysis).toEqual(original)
    expect(f.analyser.analyse).toHaveBeenCalledTimes(4)
  } finally { await f.close() }
})

test('an older job admitted later runs before a pending newer report', async () => {
  const f = storyFixture()
  try {
    f.worker.catchUp(['later'])
    f.worker.catchUp(['earlier'])
    await f.worker.tick()
    expect(f.analyser.analyse.mock.calls.map(call => call[0].article.id)).toEqual(['earlier', 'later'])
    expect(f.analyser.analyse.mock.calls[1]![3]).toHaveLength(1)
  } finally { await f.close() }
})

test('full capacity defers story refresh without losing eligibility on the next tick', async () => {
  const f = storyFixture()
  try {
    await f.analysis.analyse('later'); await f.analysis.analyse('earlier')
    f.worker.catchUp(['middle']); await f.worker.tick()
    fillQueue(f.db)
    f.worker.setSettings({ enabled: true, dailyLimit: 1 }); await f.worker.tick()
    expect(f.db.galnetBackground.pending()).toBe(100)
    expect(f.db.galnetBackground.list('pending').some(job => job.reason === 'story-context')).toBe(false)
    freeQueueSlot(f.db); await f.worker.tick()
    expect(f.db.galnetBackground.pending()).toBe(100)
    expect(f.db.galnetBackground.list('pending').some(job => job.reason === 'story-context')).toBe(true)
    expect(f.analyser.analyse).toHaveBeenCalledTimes(3)
  } finally { await f.close() }
})

test('first-install baseline and read/settings paths do not analyse historical articles', async () => {
  const f = fixture()
  try {
    expect(f.worker.status()).toMatchObject({ enabled: false, dailyLimit: 10, jobs: [] })
    await f.worker.tick()
    expect(f.news.getLatest).not.toHaveBeenCalled()
    f.enable()
    await f.worker.tick()
    expect(f.worker.status().backlog.map(item => item.articleId)).toEqual([analysisArticle.id])
    expect(f.analyser.analyse).not.toHaveBeenCalled()
    expect(f.worker.status().jobs).toEqual([])
  } finally { await f.close() }
})

test('newly received articles analyse once, share ticks and persist deduplication', async () => {
  const f = fixture()
  try {
    f.enable()
    await f.worker.tick()
    f.add(); f.advance()
    await Promise.all([f.worker.tick(), f.worker.tick()])
    expect(f.analyser.analyse).toHaveBeenCalledTimes(1)
    expect(f.worker.status()).toMatchObject({ requestsToday: 1, pending: 0,
      jobs: [{ articleId: 'new-article', reason: 'article', state: 'succeeded' }] })
    expect(f.db.galnetAnalyses.latest('new-article')?.content).toEqual(analysisContent)
    f.db.initialize()
    f.advance()
    await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(1)
  } finally { await f.close() }
})

test('old article revisions received after the baseline are new work, not a historical sweep', async () => {
  const f = fixture()
  try {
    f.enable(); await f.worker.tick()
    f.revise(); f.advance(); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(1)
    expect(f.worker.status().jobs[0]).toMatchObject({ articleId: analysisArticle.id, reason: 'article' })
  } finally { await f.close() }
})

test('manual catch-up works with automation off and deduplicates pending/current reports', async () => {
  const f = fixture()
  try {
    f.db.galnetArchive.observe([analysisArticle], '2026-10-07T12:00:00Z')
    f.worker.catchUp([analysisArticle.id, analysisArticle.id])
    f.worker.catchUp([analysisArticle.id])
    expect(f.worker.status().pending).toBe(1)
    await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(1)
    f.worker.catchUp([analysisArticle.id])
    expect(f.worker.status()).toMatchObject({ enabled: false, pending: 0, requestsToday: 1, backlog: [] })
    expect(f.news.getLatest).not.toHaveBeenCalled()
    expect(() => f.worker.catchUp([analysisArticle.id, 'not-archived'])).toThrow('not archived')
    expect(f.worker.status().pending).toBe(0)
  } finally { await f.close() }
})

test('manual catch-up executes its selected batch chronologically, one existing attempt per article', async () => {
  const f = fixture()
  try {
    const older = { ...analysisArticle, id: 'older', publishedAt: '2026-09-01T12:00:00Z' }
    f.db.galnetArchive.observe([analysisArticle, older], '2026-10-07T12:00:00Z')
    f.worker.catchUp([analysisArticle.id, older.id])
    await f.worker.tick()
    expect(f.analyser.analyse.mock.calls.map(call => call[0].article.id)).toEqual(['older', analysisArticle.id])
    expect(f.worker.status()).toMatchObject({ requestsToday: 2, pending: 0 })
  } finally { await f.close() }
})

test('failed attempts are visible, consume daily allowance and never automatically retry', async () => {
  const f = fixture()
  try {
    f.enable(); await f.worker.tick()
    f.analyser.analyse.mockRejectedValue(new Error('Synthetic provider failure'))
    f.add(); f.advance(); await f.worker.tick()
    expect(f.worker.status()).toMatchObject({ requestsToday: 1, jobs: [{ state: 'failed', error: 'Synthetic provider failure' }] })
    f.advance(); await f.worker.tick()
    f.db.initialize(); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(1)
    f.worker.catchUp(['new-article']); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(2)
  } finally { await f.close() }
})

test('daily cap leaves pending work for a later UTC day, including across repository initialization', async () => {
  const f = fixture()
  try {
    f.enable(); await f.worker.tick()
    f.worker.setSettings({ enabled: true, dailyLimit: 1 })
    f.worker.catchUp([analysisArticle.id]); f.add(); f.advance(); await f.worker.tick()
    expect(f.worker.status()).toMatchObject({ requestsToday: 1, pending: 1 })
    f.db.initialize(); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(1)
    f.advance(24 * 60); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(2)
    expect(f.worker.status()).toMatchObject({ requestsToday: 1, pending: 0 })
  } finally { await f.close() }
})

test('CG counters and disappearing goals do not trigger analysis; changed briefing updates related reports', async () => {
  const f = fixture()
  try {
    f.enable(); await f.worker.tick()
    f.worker.catchUp([analysisArticle.id]); await f.worker.tick()
    f.goals({ ...analysisGoals, goals: analysisGoals.goals.map(goal => ({ ...goal, contributed: 900 })) })
    f.advance(); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(1)
    f.goals({ ...analysisGoals, goals: analysisGoals.goals.map(goal => ({ ...goal, briefing: 'Updated orders.' })) })
    f.advance(); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(2)
    expect(f.worker.status().jobs[0]?.reason).toBe('community-goal')
    f.goals({ ...analysisGoals, goals: [] }); f.advance(); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(2)
  } finally { await f.close() }
})

test('stale source evidence does not advance observations or queue AI', async () => {
  const f = fixture()
  try {
    f.enable(); await f.worker.tick()
    f.add(); f.advance()
    f.goals({ ...analysisGoals, cache: 'stale' })
    await f.worker.tick()
    expect(f.worker.status().sourceError).toContain('stale')
    expect(f.analyser.analyse).not.toHaveBeenCalled()
    f.goals(analysisGoals); f.advance(); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(1)
  } finally { await f.close() }
})

test('no key pauses pending requests; interrupted jobs become failed, not pending', async () => {
  const f = fixture()
  try {
    f.enable(); await f.worker.tick()
    f.configured(false); f.add(); f.advance(); await f.worker.tick()
    expect(f.worker.status()).toMatchObject({ configured: false, pending: 1 })
    expect(f.analyser.analyse).not.toHaveBeenCalled()
    const job = f.db.galnetBackground.list('pending')[0]!
    f.db.galnetBackground.put({ ...job, state: 'running', startedAt: '2026-10-07T12:16:00Z' })
    f.db.initialize()
    expect(f.worker.status().jobs[0]).toMatchObject({ state: 'failed', error: expect.stringContaining('Retry manually') })
    f.configured(true); await f.worker.tick()
    expect(f.analyser.analyse).not.toHaveBeenCalled()
  } finally { await f.close() }
})

test('turning off pauses unstarted automatic work and shutdown never starts another request', async () => {
  const f = fixture()
  try {
    f.enable(); await f.worker.tick()
    f.configured(false); f.add(); f.advance(); await f.worker.tick()
    f.worker.setSettings({ enabled: false, dailyLimit: 10 })
    f.configured(true); await f.worker.tick()
    expect(f.analyser.analyse).not.toHaveBeenCalled()
    await f.worker.stop()
    f.enable(); await f.worker.tick()
    expect(f.analyser.analyse).not.toHaveBeenCalled()
  } finally { await f.close() }
})

test('a failed source does not release ownership of another reader still writing during shutdown', async () => {
  const f = fixture()
  let release!: () => void
  const sourceFinished = new Promise<void>(resolve => { release = resolve })
  try {
    f.enable()
    f.news.getLatest.mockImplementationOnce(async () => {
      await sourceFinished
      f.db.galnetArchive.observe([analysisArticle], '2026-10-07T12:00:00Z')
      return { articles: [analysisArticle], cache: 'refreshed', fetchedAt: '2026-10-07T12:00:00Z' }
    })
    f.goalReader.getCurrent.mockRejectedValueOnce(new Error('CG source unavailable'))
    const work = f.worker.tick()
    let stopped = false
    const stop = f.worker.stop().then(() => { stopped = true })
    await Promise.resolve(); await Promise.resolve()
    expect(stopped).toBe(false)
    release()
    await Promise.all([work, stop])
    expect(f.db.galnetArchive.getArticle(analysisArticle.id)).not.toBeNull()
    expect(f.analyser.analyse).not.toHaveBeenCalled()
  } finally { release(); await f.close() }
})

test('a superseded queued revision is skipped without an inference request or attempt charge', async () => {
  const f = fixture()
  try {
    f.enable(); await f.worker.tick()
    f.worker.catchUp([analysisArticle.id])
    f.db.galnetArchive.observe([{ ...analysisArticle, title: 'Updated source before work began' }], '2026-10-07T12:01:00Z')
    await f.worker.tick()
    expect(f.worker.status()).toMatchObject({ requestsToday: 0, pending: 0, jobs: [{ state: 'skipped' }] })
    expect(f.analyser.analyse).not.toHaveBeenCalled()
  } finally { await f.close() }
})

test('shutdown aborts an active analysis, retains failed-work diagnostics and leaves later work pending', async () => {
  const f = fixture()
  let release!: () => void
  const result = new Promise<void>(resolve => { release = resolve })
  try {
    f.db.galnetArchive.observe([analysisArticle, { ...analysisArticle, id: 'second-article' }], '2026-10-07T12:00:00Z')
    f.worker.catchUp([analysisArticle.id, 'second-article'])
    f.analyser.analyse.mockImplementationOnce(async () => {
      await result
      return { content: structuredClone(analysisContent), continuity: null, usage: analysisUsage }
    })
    const work = f.worker.tick()
    await vi.waitFor(() => expect(f.analyser.analyse).toHaveBeenCalledTimes(1))
    const stop = Promise.all([f.worker.stop(), f.analysis.stop()])
    release()
    await Promise.all([work, stop])
    expect(f.analyser.analyse).toHaveBeenCalledTimes(1)
    expect(f.db.galnetAnalyses.latest(analysisArticle.id)).toBeNull()
    expect(f.worker.status()).toMatchObject({ pending: 1, requestsToday: 1 })
    expect(f.worker.status().jobs.some(job => job.state === 'failed')).toBe(true)
  } finally { release(); await f.close() }
})

test('a real SQLite reopen retains consent, observations, pending work and attempt accounting', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-galnet-queue-'))
  const path = join(directory, 'queue.sqlite')
  let db = new SqliteDatabase(path)
  try {
    db.initialize()
    const settings = { ...db.galnetBackground.load(), enabled: true, dailyLimit: 5 }
    db.galnetBackground.save(settings)
    db.galnetBackground.observe('old-article', 'revision-one')
    const job = { id: 'synthetic-one', articleId: 'old-article', articleRevisionId: 'revision-one', title: 'Synthetic article',
      reason: 'catch-up' as const, state: 'running' as const, queuedAt: '2026-10-07T12:00:00Z',
      startedAt: '2026-10-07T12:01:00Z', finishedAt: null, error: null }
    db.galnetBackground.enqueue(job)
    db.galnetBackground.enqueue({ ...job, id: 'synthetic-two', articleId: 'another-article', state: 'pending', startedAt: null })
    db.close()
    db = new SqliteDatabase(path)
    db.initialize()
    expect(db.galnetBackground.load()).toEqual(settings)
    expect(db.galnetBackground.observe('old-article', 'revision-two')).toBe('revision-one')
    expect(db.galnetBackground.pending()).toBe(1)
    expect(db.galnetBackground.next(false)?.id).toBe('synthetic-two')
    expect(db.galnetBackground.requestsSince('2026-10-07T00:00:00Z')).toBe(1)
    expect(db.galnetBackground.list('failed')[0]?.error).toContain('Retry manually')
    const jobs = db.galnetBackground.list()
    db.initialize()
    expect(db.galnetBackground.list()).toEqual(jobs)
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }) }
})

function fillQueue(db: SqliteDatabase) {
  for (let index = 0; index < 100; index++) expect(db.galnetBackground.enqueue({
    id: `capacity-${index}`, articleId: `capacity-${index}`, articleRevisionId: 'revision', title: 'Synthetic queued article',
    reason: 'article', state: 'pending', queuedAt: '2026-10-07T12:00:00Z', startedAt: null, finishedAt: null, error: null
  })).toBe(true)
}

function freeQueueSlot(db: SqliteDatabase) {
  const job = db.galnetBackground.next(true)!
  db.galnetBackground.put({ ...job, state: 'skipped', finishedAt: '2026-10-07T13:00:00Z' })
}

test('automatic article admission obeys capacity and leaves rejected evidence eligible for a later poll', async () => {
  const f = fixture()
  try {
    f.enable(); await f.worker.tick(); f.configured(false)
    fillQueue(f.db)
    f.add(); f.advance(); await f.worker.tick()
    expect(f.worker.status()).toMatchObject({ pending: 100, sourceError: expect.stringContaining('queue is full') })
    expect(f.db.galnetBackground.observed('new-article')).toBeNull()
    const existing = f.db.galnetBackground.next(true)!
    expect(f.db.galnetBackground.enqueue(existing)).toBe(true)
    f.configured(true)
    expect(() => f.worker.catchUp([analysisArticle.id])).toThrow(expect.objectContaining({ code: 'galnet_background_queue_full' }))
    f.configured(false)
    freeQueueSlot(f.db); f.advance(); await f.worker.tick()
    expect(f.worker.status()).toMatchObject({ pending: 100, sourceError: null })
    expect(f.db.galnetBackground.observed('new-article')).toBe(f.db.galnetArchive.getArticle('new-article')!.revisionId)
    expect(f.analyser.analyse).not.toHaveBeenCalled()
  } finally { await f.close() }
})

test('CG admission obeys capacity without consuming the changed briefing baseline', async () => {
  const f = fixture()
  try {
    f.enable(); await f.worker.tick()
    f.worker.catchUp([analysisArticle.id]); await f.worker.tick(); f.configured(false)
    const baseline = f.db.galnetBackground.load().goals
    fillQueue(f.db)
    f.goals({ ...analysisGoals, goals: analysisGoals.goals.map(goal => ({ ...goal, briefing: 'Updated orders.' })) })
    f.advance(); await f.worker.tick()
    expect(f.db.galnetBackground.pending()).toBe(100)
    expect(f.db.galnetBackground.load().goals).toEqual(baseline)
    freeQueueSlot(f.db); f.advance(); await f.worker.tick()
    expect(f.db.galnetBackground.load().goals).not.toEqual(baseline)
    expect(f.db.galnetBackground.list('pending').some(job => job.reason === 'community-goal')).toBe(true)
    expect(f.analyser.analyse).toHaveBeenCalledTimes(1)
  } finally { await f.close() }
})

test.each(['before-admission', 'after-admission'] as const)('failure %s never loses automatic work or creates duplicate jobs', async stage => {
  const f = fixture()
  try {
    f.enable(); await f.worker.tick(); f.configured(false)
    if (stage === 'before-admission') vi.spyOn(f.db.galnetBackground, 'enqueue').mockImplementationOnce(() => { throw new Error('Synthetic write failure') })
    else {
      const observe = f.db.galnetBackground.observe.bind(f.db.galnetBackground)
      vi.spyOn(f.db.galnetBackground, 'observe').mockImplementation((id, revision) => {
        if (id === 'new-article') throw new Error('Synthetic exit after admission')
        return observe(id, revision)
      })
    }
    f.add(); f.advance(); await f.worker.tick()
    expect(f.db.galnetBackground.observed('new-article')).toBeNull()
    expect(f.db.galnetBackground.pending()).toBe(stage === 'before-admission' ? 0 : 1)
    vi.restoreAllMocks()
    f.advance(); await f.worker.tick()
    expect(f.db.galnetBackground.pending()).toBe(1)
    expect(f.db.galnetBackground.observed('new-article')).not.toBeNull()
    f.configured(true); await f.worker.tick()
    expect(f.analyser.analyse).toHaveBeenCalledTimes(1)
  } finally { vi.restoreAllMocks(); await f.close() }
})
