import { expect, test, vi } from 'vitest'
import type { ProviderCacheEntry, ProviderResponseCache } from '../apps/server/src/domain/station-market.js'
import { ProviderQueryCache } from '../apps/server/src/application/provider-query-cache.js'

function fixture() {
  const entries = new Map<string, ProviderCacheEntry>()
  const store: ProviderResponseCache = {
    getProviderResponse: (namespace, key) => entries.get(JSON.stringify([namespace, key])) ?? null,
    putProviderResponse: (namespace, key, fetchedAt, value) => {
      entries.set(JSON.stringify([namespace, key]), { fetchedAt, value })
    }
  }
  return { store, cache: new ProviderQueryCache(store, () => new Date('2026-10-04T12:00:00Z')) }
}

const isNumbers = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every(item => typeof item === 'number' && Number.isFinite(item))

test('invalid refreshes preserve the last good response across repeated failures', async () => {
  const { store, cache } = fixture()
  store.putProviderResponse('stations', 'Sol', '2026-10-03T12:00:00Z', [1])
  const load = vi.fn(async () => ['invalid'] as unknown as number[])
  for (let attempt = 0; attempt < 2; attempt++) {
    expect(await cache.get('stations', 'Sol', 1000, load, isNumbers)).toEqual({ cache: 'stale', value: [1] })
  }
  expect(store.getProviderResponse('stations', 'Sol')).toEqual({ fetchedAt: '2026-10-03T12:00:00Z', value: [1] })
  expect(await cache.get('stations', 'Sol', 1000, async () => [2], isNumbers)).toEqual({ cache: 'refreshed', value: [2] })
})

test('concurrent refreshes share one request and failed requests can be retried', async () => {
  const { store, cache } = fixture()
  const load = vi.fn(async () => ['invalid'] as unknown as number[])
  const results = await Promise.allSettled([
    cache.get('stations', 'Sol', 1000, load, isNumbers),
    cache.get('stations', 'Sol', 1000, load, isNumbers)
  ])
  expect(results.map(result => result.status)).toEqual(['rejected', 'rejected'])
  expect(load).toHaveBeenCalledTimes(1)
  expect(store.getProviderResponse('stations', 'Sol')).toBeNull()
  expect(await cache.get('stations', 'Sol', 1000, async () => [3], isNumbers)).toEqual({ cache: 'refreshed', value: [3] })
})

test('namespace and key delimiters cannot alias concurrent queries', async () => {
  const { store, cache } = fixture()
  const results = await Promise.all([
    cache.get('provider:stations', 'Sol', 1000, async () => [1], isNumbers),
    cache.get('provider', 'stations:Sol', 1000, async () => [2], isNumbers)
  ])
  expect(results.map(result => result.value)).toEqual([[1], [2]])
  expect(store.getProviderResponse('provider:stations', 'Sol')?.value).toEqual([1])
  expect(store.getProviderResponse('provider', 'stations:Sol')?.value).toEqual([2])
})
