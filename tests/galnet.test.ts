import { expect, test, vi } from 'vitest'
import { GalnetNewsService } from '../apps/server/src/application/galnet-news-service.js'
import type { GalnetArticleArchive, GalnetSource } from '../apps/server/src/domain/galnet.js'
import type { ProviderCacheEntry, ProviderResponseCache } from '../apps/server/src/domain/station-market.js'
import { FrontierGalnetSource } from '../apps/server/src/infrastructure/frontier-galnet-source.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'

const article = {
  body: 'Broadcast body.',
  id: 'article-1',
  image: 'NewsImageTest',
  publishedAt: '2026-08-06T12:05:10+00:00',
  title: 'Test Broadcast'
}

const sourceArticle = {
  ...article,
  changedAt: '2026-08-06T12:05:10+00:00',
  slug: 'test-broadcast',
  sourceUrl: 'https://cms.zaonce.net/en-GB/jsonapi/node/galnet_article/article-1'
}

test('Frontier GalNet source converts the official JSON API document', async () => {
  let requestedUrl = ''
  const source = new FrontierGalnetSource(async input => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({
      data: [{
        attributes: {
          body: { value: article.body },
          field_galnet_image: article.image,
          published_at: article.publishedAt,
          changed: sourceArticle.changedAt,
          field_slug: sourceArticle.slug,
          title: article.title
        },
        id: article.id,
        type: 'node--galnet_article'
      }]
    }), { headers: { 'content-type': 'application/vnd.api+json' }, status: 200 })
  })

  await expect(source.getLatest(12)).resolves.toEqual([sourceArticle])
  expect(requestedUrl).toContain('sort=-published_at')
  expect(requestedUrl).toContain('page%5Blimit%5D=12')
})

test('Frontier source preserves missing slug as unknown and rejects malformed change dates', async () => {
  const attributes = { body: { value: article.body }, field_galnet_image: article.image,
    published_at: article.publishedAt, title: article.title, changed: sourceArticle.changedAt }
  const source = new FrontierGalnetSource(async () => new Response(JSON.stringify({
    data: [{ id: article.id, attributes }]
  })))
  await expect(source.getLatest(1)).resolves.toEqual([{ ...sourceArticle, slug: null }])
  attributes.changed = 'invalid date'
  await expect(source.getLatest(1)).rejects.toThrow()
})

test('GalNet service retains articles as offline stale fallback', async () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const cache = new MemoryProviderCache()
    const online = new GalnetNewsService({ getLatest: async () => [sourceArticle] }, cache, database.galnetArchive, () => new Date('2026-08-14T10:00:00Z'))
    await expect(online.getLatest()).resolves.toMatchObject({ articles: [article], cache: 'refreshed' })

    const offlineSource: GalnetSource = { getLatest: async () => { throw new Error('offline') } }
    const offline = new GalnetNewsService(offlineSource, cache, database.galnetArchive, () => new Date('2026-08-14T11:00:00Z'))
    await expect(offline.getLatest()).resolves.toMatchObject({ articles: [article], cache: 'stale' })
    expect(database.galnetArchive.listRevisions(article.id)).toHaveLength(1)
    expect(database.galnetArchive.getArticle(article.id)?.lastObservedAt).toBe('2026-08-14T10:00:00.000Z')
  } finally { database.close() }
})

test('GalNet refresh archives and caches once for concurrent callers, keeping feed limits and contract', async () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    let release!: (articles: typeof sourceArticle[]) => void
    const source = { getLatest: vi.fn(() => new Promise<typeof sourceArticle[]>(resolve => { release = resolve })) }
    const archive = vi.spyOn(database.galnetArchive, 'observe')
    const cache = vi.spyOn(database, 'putProviderResponse')
    const now = () => new Date('2026-08-14T10:00:00Z')
    const service = new GalnetNewsService(source, database, database.galnetArchive, now)
    const first = service.getLatest(1)
    const second = service.getLatest(2)
    release([sourceArticle, { ...sourceArticle, id: 'article-2' }])
    expect((await first).articles).toEqual([article])
    expect((await second).articles).toHaveLength(2)
    expect(source.getLatest).toHaveBeenCalledExactlyOnceWith(100)
    expect(archive).toHaveBeenCalledTimes(1)
    expect(cache).toHaveBeenCalledTimes(1)
    expect(database.galnetArchive.getArticle(article.id)?.article).toEqual(sourceArticle)
    expect((await service.getLatest()).cache).toBe('fresh')
    expect(archive).toHaveBeenCalledTimes(1)
  } finally { database.close() }
})

test('a successful empty feed does not resurrect archived articles', async () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    database.galnetArchive.observe([sourceArticle], '2026-08-14T09:00:00.000Z')
    const service = new GalnetNewsService({ getLatest: async () => [] }, database, database.galnetArchive)
    await expect(service.getLatest()).resolves.toMatchObject({ articles: [], cache: 'refreshed' })
    expect(database.galnetArchive.getArticle(article.id)?.article).toEqual(sourceArticle)
  } finally { database.close() }
})

test('archive failure does not mark the latest feed fresh, and failed refresh can retry', async () => {
  const cache = new MemoryProviderCache()
  const archive = { observe: vi.fn<GalnetArticleArchive['observe']>(() => { throw new Error('disk failure') }), getArticle: () => null, listRevisions: () => [] }
  const source = { getLatest: vi.fn(async () => [sourceArticle]) }
  const service = new GalnetNewsService(source, cache, archive)
  await expect(service.getLatest()).rejects.toThrow('disk failure')
  expect(cache.getProviderResponse('frontier-galnet', 'latest')).toBeNull()
  archive.observe.mockImplementation(() => {})
  await expect(service.getLatest()).resolves.toMatchObject({ articles: [article], cache: 'refreshed' })
  expect(source.getLatest).toHaveBeenCalledTimes(2)
})

class MemoryProviderCache implements ProviderResponseCache {
  private readonly entries = new Map<string, ProviderCacheEntry>()

  public getProviderResponse (namespace: string, key: string): ProviderCacheEntry | null {
    return this.entries.get(`${namespace}:${key}`) ?? null
  }

  public putProviderResponse (namespace: string, key: string, fetchedAt: string, value: unknown): void {
    this.entries.set(`${namespace}:${key}`, { fetchedAt, value })
  }
}
