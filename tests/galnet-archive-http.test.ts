import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, vi } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

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
