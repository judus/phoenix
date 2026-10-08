import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, vi } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { PairingAccessController } from '../apps/server/src/infrastructure/pairing-access-controller.js'
import { analysisArticle } from './support/galnet-analysis-fixtures.js'

test('paired archive HTTP/client reads retained articles with the source offline and no inference or writes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-galnet-browse-'))
  const path = join(directory, 'state.sqlite')
  const seed = new SqliteDatabase(path)
  seed.initialize()
  seed.galnetArchive.observe([analysisArticle], '2026-10-07T10:00:00Z')
  const before = seed.galnetArchive.listRevisions(analysisArticle.id)
  seed.close()
  const source = { getLatest: vi.fn(async () => { throw new Error('offline') }) }
  const analyse = vi.fn(async () => { throw new Error('No inference allowed') })
  const access = new PairingAccessController(join(directory, 'pairing.json'))
  const app = new PhoenixApplication({ databasePath: path, eliteDirectory: null, host: '127.0.0.1', port: 0,
    copilot: null, copilotRealtime: null, openAiEnvironmentKey: null, accessControl: access,
    galnetSource: source, galnetAnalyser: { model: 'synthetic', configured: () => false, analyse } })
  try {
    const address = await app.start()
    const origin = `http://${address.host}:${address.port}`
    for (const route of ['/api/galnet/archive', '/api/galnet/archive/article?articleId=synthetic-analysis']) {
      expect((await fetch(origin + route)).status).toBe(401)
    }
    const claim = await fetch(`${origin}/api/pairing/claim`, { method: 'POST', body: JSON.stringify({ code: access.pairingCode }) })
    const cookie = claim.headers.get('set-cookie')!.split(';')[0]!
    const request: typeof fetch = (input, init) => fetch(input, { ...init, headers: { ...init?.headers, cookie } })
    const client = new PhoenixApiClient(origin, request)
    expect(await client.getGalnetArchive({ query: '  BEACON  ', offset: 0, limit: 1 })).toEqual({
      articles: [{ id: analysisArticle.id, title: analysisArticle.title, publishedAt: analysisArticle.publishedAt }], total: 1, offset: 0, limit: 1
    })
    expect(await client.getGalnetArchivedArticle(analysisArticle.id)).toMatchObject({
      article: { id: analysisArticle.id, body: analysisArticle.body }, sourceUrl: analysisArticle.sourceUrl,
      revisionId: before[0]!.revisionId, firstObservedAt: before[0]!.firstObservedAt, lastObservedAt: before[0]!.lastObservedAt
    })
    for (const query of ['limit=0', 'limit=101', 'offset=-1', 'offset=1.5', 'limit=nope', `query=${'x'.repeat(201)}`, 'unknown=1']) {
      const invalid = await request(`${origin}/api/galnet/archive?${query}`)
      expect(invalid.status).toBe(400)
      expect(await invalid.json()).toMatchObject({ error: { code: 'invalid_request', message: expect.any(String) } })
    }
    const missingId = await request(`${origin}/api/galnet/archive/article`)
    expect(missingId.status).toBe(400)
    expect(await missingId.json()).toMatchObject({ error: { code: 'invalid_request', message: expect.stringContaining('articleId') } })
    expect((await request(`${origin}/api/galnet/archive/article?articleId=missing`)).status).toBe(404)
    await expect(client.getGalnetArchivedArticle('missing')).rejects.toThrow('Retained GalNet article not found.')
    await expect(client.getGalnetArchive({ query: '', limit: 101, offset: 0 })).rejects.toThrow('limit:')
    expect(source.getLatest).not.toHaveBeenCalled()
    expect(analyse).not.toHaveBeenCalled()
    await app.stop()
    const reopened = new SqliteDatabase(path)
    try { reopened.initialize(); expect(reopened.galnetArchive.listRevisions(analysisArticle.id)).toEqual(before) }
    finally { reopened.close() }
  } finally { await app.stop(); rmSync(directory, { recursive: true, force: true }) }
})

test('real GalNet HTTP composition preserves the public contract and durably archives source evidence', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-galnet-http-'))
  const path = join(directory, 'state.sqlite')
  const article = { body: 'Synthetic broadcast.', id: 'synthetic-http', image: null,
    title: 'Synthetic report', publishedAt: '2026-10-01T11:00:00+00:00' }
  const evidence = { ...article, changedAt: article.publishedAt, slug: 'synthetic-report',
    sourceUrl: 'https://cms.zaonce.net/en-GB/jsonapi/node/galnet_article/synthetic-http' }
  const source = { getLatest: vi.fn(async () => [evidence]) }
  const app = new PhoenixApplication({ databasePath: path, eliteDirectory: null,
    host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null, openAiEnvironmentKey: null,
    galnetSource: source })
  try {
    const address = await app.start()
    const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    const response = await client.getGalnetNews(1)
    expect(response.articles).toEqual([article])
    expect(response.cache).toBe('refreshed')
    expect((await client.getGalnetNews(1)).cache).toBe('fresh')
    expect(source.getLatest).toHaveBeenCalledExactlyOnceWith(100)
    await app.stop()
    const retained = new SqliteDatabase(path)
    try {
      retained.initialize()
      expect(retained.galnetArchive.getArticle(article.id)).toMatchObject({
        schemaVersion: 1, article: evidence, firstObservedAt: response.fetchedAt, lastObservedAt: response.fetchedAt
      })
      expect(retained.galnetArchive.listRevisions(article.id)).toHaveLength(1)
    } finally { retained.close() }
  } finally {
    await app.stop()
    rmSync(directory, { recursive: true, force: true })
  }
})
