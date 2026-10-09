import { expect, test, vi } from 'vitest'
import type { AtlasPoi } from '@phoenix/contracts'
import { AtlasCatalogueService } from '../apps/server/src/application/atlas-catalogue-service.js'
import { atlasPoiSources } from '../apps/server/src/infrastructure/atlas-poi-sources.js'
import type { AtlasPoiSource } from '../apps/server/src/domain/atlas.js'
import type { ProviderCacheEntry, ProviderResponseCache } from '../apps/server/src/domain/station-market.js'

const poi: AtlasPoi = {
  id: 'gec:1', label: 'Synthetic scenery', systemName: 'Example', position: [10, 20, 30],
  categories: ['Sights and Scenery'], source: 'Galactic Exploration Catalog', sourceUrl: 'https://edastro.com/gec/view/1'
}
function fixture() {
  const entries = new Map<string, ProviderCacheEntry>()
  const cache: ProviderResponseCache = {
    getProviderResponse: (namespace, key) => entries.get(`${namespace}:${key}`) ?? null,
    putProviderResponse: (namespace, key, fetchedAt, value) => { entries.set(`${namespace}:${key}`, { fetchedAt, value }) }
  }
  const source: AtlasPoiSource = { id: 'gec', name: poi.source, url: 'https://edastro.com/gec/json/all', licence: 'CC BY-NC-SA 3.0', getPois: vi.fn(async () => ({ pois: [poi], rejected: 0 })) }
  return { cache, source }
}

test('GEC preserves source categories and IDs, rejects malformed/duplicate records without fabricating coordinates', async () => {
  const row = { id: 1, name: poi.label, galMapSearch: 'Example', coordinates: [10, 20, 30], type: 'Sights and Scenery', type2: 'Historical' }
  const request = vi.fn(async () => new Response(JSON.stringify([row, row, { ...row, id: 2, coordinates: [null, 0, 0] }, null])))
  const result = await atlasPoiSources(request)[0]!.getPois()
  expect(result.pois).toEqual([{ ...poi, categories: ['Sights and Scenery', 'Historical'] }])
  expect(result.rejected).toBe(3)
  expect(request).toHaveBeenCalledWith('https://edastro.com/gec/json/all', expect.objectContaining({ signal: expect.any(AbortSignal) }))
})

test('Guardian feeds preserve distinct sites, body and type, and reject empty/nonnumeric coordinate strings', async () => {
  const row = { SiteId: '1', 'System Name': 'Example', 'Body Name': 'A 1', 'Site Type': 'Turtle', x: '10', y: '-20.5', z: '30' }
  const request = async () => new Response(JSON.stringify([row, { ...row, SiteId: '2' }, { ...row, SiteId: '3', x: '' }, { ...row, SiteId: '4', x: '10oops' }, { ...row, SiteId: '5', x: '1,580.625' }]))
  const result = await atlasPoiSources(request)[1]!.getPois()
  expect(result.pois).toHaveLength(3)
  expect(result.pois[2]?.position[0]).toBe(1580.625)
  expect(result.pois[0]).toMatchObject({ id: 'canonn:guardian_structures:1', position: [10, -20.5, 30], bodyName: 'A 1', siteType: 'Turtle', categories: ['Guardian Structures'] })
  expect(result.pois[0]?.surface).toBeUndefined()
  expect(result.rejected).toBe(2)
  expect(result.pois[0]?.sourceUrl).toBe('https://map.canonn.tech/gs-data.html')
})

test('source failures and wholly invalid feeds reject rather than erase the retained catalogue', async () => {
  await expect(atlasPoiSources(async () => new Response('[]'))[0]!.getPois()).rejects.toThrow('no valid POIs')
  await expect(atlasPoiSources(async () => new Response('{}'))[0]!.getPois()).rejects.toThrow('invalid catalogue')
  await expect(atlasPoiSources(async () => new Response('', { status: 503 }))[0]!.getPois()).rejects.toThrow('503')
})

test('catalogue requests coalesce, remain fresh for 24 hours and survive offline refreshes independently', async () => {
  const { cache, source } = fixture()
  let now = new Date('2026-10-06T12:00:00Z')
  const broken: AtlasPoiSource = { ...source, id: 'broken', name: 'Broken feed', getPois: async () => { throw new Error('Offline') } }
  const service = new AtlasCatalogueService([source, broken], cache, () => now)
  const [first, concurrent] = await Promise.all([service.getCatalogue(), service.getCatalogue()])
  expect(first.pois).toEqual([poi])
  expect(concurrent.pois).toEqual([poi])
  expect(source.getPois).toHaveBeenCalledTimes(1)
  expect(first.sources.map(source => source.cache)).toEqual(['refreshed', 'unavailable'])
  expect(first.sources[1]?.error).toBe('Offline')
  expect((await service.getCatalogue()).sources[0]?.cache).toBe('fresh')
  expect(source.getPois).toHaveBeenCalledTimes(1)
  now = new Date('2026-10-08T12:00:00Z')
  source.getPois = vi.fn(async () => { throw new Error('Offline') })
  const offline = await service.getCatalogue()
  expect(offline.pois).toEqual([poi])
  expect(offline.sources[0]).toMatchObject({ cache: 'stale', fetchedAt: '2026-10-06T12:00:00.000Z' })
  source.getPois = async () => ({ pois: [], rejected: 0 })
  expect((await service.getCatalogue()).sources[0]?.cache).toBe('stale')
  const restart = new AtlasCatalogueService([source], cache, () => now)
  expect((await restart.getCatalogue()).pois).toEqual([poi])
})
