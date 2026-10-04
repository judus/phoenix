import { expect, test } from 'vitest'
import { BoundedCache, DEFAULT_BROWSER_CACHE_ENTRIES } from '../apps/web/src/application/cache/bounded-cache.js'
import { readControllerSnapshot, storeControllerSnapshot } from '../apps/web/src/application/cache/controller-snapshot-cache.js'
import { GALAXY_QUERY_CATALOGUE } from '../apps/web/src/features/galaxy/galaxy-query-catalogue.js'
import { GalaxyQuerySessionStore } from '../apps/web/src/features/galaxy/galaxy-query-session-store.js'

test('a long system-browsing session retains only a bounded set of recent controller snapshots', () => {
  const api = {}
  for (let index = 0; index < 1000; index += 1) {
    storeControllerSnapshot(api, `galaxy:system:Test ${index}`, { lookup: { system: { name: `Test ${index}` } } })
  }
  expect(readControllerSnapshot(api, 'galaxy:system:Test 0')).toBeUndefined()
  expect(readControllerSnapshot(api, 'galaxy:system:Test 999')).toEqual({ lookup: { system: { name: 'Test 999' } } })
  const retained = Array.from({ length: 1000 }, (_, index) => readControllerSnapshot(api, `galaxy:system:Test ${index}`))
    .filter(snapshot => snapshot !== undefined)
  expect(retained.length).toBeLessThanOrEqual(DEFAULT_BROWSER_CACHE_ENTRIES)
})

test('saved-query session history is bounded without discarding default query drafts', () => {
  const sessions = new GalaxyQuerySessionStore()
  for (const definition of GALAXY_QUERY_CATALOGUE) sessions.set(definition.id, { values: { origin: 'My draft' } })
  for (let index = 0; index < 1000; index += 1) {
    sessions.set(`saved-${index}`, { values: { origin: `System ${index}` } })
  }
  expect(sessions.get('saved-0')).toBeUndefined()
  expect(sessions.get('saved-999')?.values.origin).toBe('System 999')
  for (const definition of GALAXY_QUERY_CATALOGUE) expect(sessions.get(definition.id)?.values.origin).toBe('My draft')
})

test('cache reads and replacements retain recently used entries without growing the cache', () => {
  const cache = new BoundedCache<number>(3)
  cache.set('first', 1)
  cache.set('second', 2)
  cache.set('third', 3)
  expect(cache.get('first')).toBe(1)
  cache.set('fourth', 4)
  expect(cache.get('second')).toBeUndefined()
  cache.set('third', 30)
  cache.set('fifth', 5)
  expect(cache.get('first')).toBeUndefined()
  expect(cache.get('third')).toBe(30)
  expect(cache.get('fourth')).toBe(4)
  expect(cache.get('fifth')).toBe(5)
})

test('controller cache budgets are independent for separate API owners', () => {
  const firstApi = {}
  const secondApi = {}
  storeControllerSnapshot(firstApi, 'current-view', { status: 'ready' })
  for (let index = 0; index < 1000; index += 1) storeControllerSnapshot(secondApi, `system-${index}`, { index })
  expect(readControllerSnapshot(firstApi, 'current-view')).toEqual({ status: 'ready' })
  expect(readControllerSnapshot(secondApi, 'current-view')).toBeUndefined()
})
