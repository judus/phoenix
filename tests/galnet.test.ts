import { expect, test } from 'vitest'
import { GalnetNewsService } from '../apps/server/src/application/galnet-news-service.js'
import type { GalnetSource } from '../apps/server/src/domain/galnet.js'
import type { ProviderCacheEntry, ProviderResponseCache } from '../apps/server/src/domain/station-market.js'
import { FrontierGalnetSource } from '../apps/server/src/infrastructure/frontier-galnet-source.js'

const article = {
  body: 'Broadcast body.',
  id: 'article-1',
  image: 'NewsImageTest',
  publishedAt: '2026-08-06T12:05:10+00:00',
  title: 'Test Broadcast'
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
          title: article.title
        },
        id: article.id,
        type: 'node--galnet_article'
      }]
    }), { headers: { 'content-type': 'application/vnd.api+json' }, status: 200 })
  })

  await expect(source.getLatest(12)).resolves.toEqual([article])
  expect(requestedUrl).toContain('sort=-published_at')
  expect(requestedUrl).toContain('page%5Blimit%5D=12')
})

test('GalNet service retains articles as offline stale fallback', async () => {
  const cache = new MemoryProviderCache()
  const online = new GalnetNewsService({ getLatest: async () => [article] }, cache, () => new Date('2026-08-14T10:00:00Z'))
  await expect(online.getLatest()).resolves.toMatchObject({ articles: [article], cache: 'refreshed' })

  const offlineSource: GalnetSource = { getLatest: async () => { throw new Error('offline') } }
  const offline = new GalnetNewsService(offlineSource, cache, () => new Date('2026-08-14T11:00:00Z'))
  await expect(offline.getLatest()).resolves.toMatchObject({ articles: [article], cache: 'stale' })
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
