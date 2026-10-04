import { expect, test, vi } from 'vitest'
import { SpanshSystemSearchSource } from '../apps/server/src/infrastructure/spansh-system-search-source.js'
import type { SystemSearchRequest } from '../apps/server/src/domain/station-market.js'
import type { SpanshSearchRequest } from '../apps/server/src/infrastructure/spansh-search-client.js'

test.each([
  { population: 'any', min: null, max: null, filter: undefined, expected: [0, 5, 10] },
  { population: 'inhabited', min: null, max: null, filter: { comparison: '>=', value: 1 }, expected: [5, 10] },
  { population: 'inhabited', min: 0, max: null, filter: { comparison: '>=', value: 1 }, expected: [5, 10] },
  { population: 'uninhabited', min: null, max: 500, filter: { comparison: '<=', value: 0 }, expected: [0] },
  { population: 'any', min: 6, max: null, filter: { comparison: '>=', value: 6 }, expected: [10] },
  { population: 'any', min: null, max: 6, filter: { comparison: '<=', value: 6 }, expected: [0, 5] },
  { population: 'any', min: 3, max: 6, filter: { comparison: '<=>', value: [3, 6] }, expected: [5] }
] as const)('population search uses the provider numeric contract and validates $population bounds $min..$max', async ({ population, min, max, filter, expected }) => {
  const search = vi.fn(async (_index: unknown, _request: SpanshSearchRequest) => [0, 5, 10, undefined, -1].map(value => ({
    name: `Population ${value}`, population: value, distance: 1, x: 0, y: 0, z: 0
  })))
  const source = new SpanshSystemSearchSource({ search, findFieldValues: async () => [] })
  const request: SystemSearchRequest = {
    allegiance: null, economy: null, government: null, security: null, maxDistanceLy: 100,
    minPopulation: min, maxPopulation: max, population, referencePosition: [0, 0, 0]
  }
  expect((await source.findSystems(request)).map(system => system.population)).toEqual(expected)
  expect(search.mock.calls[0]?.[1].filters.population).toEqual(filter)
})
