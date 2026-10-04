import { expect, test, vi } from 'vitest'
import { SpanshMaterialTraderSource } from '../apps/server/src/infrastructure/spansh-material-trader-source.js'
import { SpanshStationServiceSource } from '../apps/server/src/infrastructure/spansh-station-service-source.js'
import { SpanshStationLookupSource } from '../apps/server/src/infrastructure/spansh-station-lookup-source.js'
import { SpanshOutfittingSearchSource } from '../apps/server/src/infrastructure/spansh-outfitting-search-source.js'
import { searchSpanshStations } from '../apps/server/src/infrastructure/spansh-station-search.js'
import type { SpanshSearchGateway, SpanshSearchRequest } from '../apps/server/src/infrastructure/spansh-search-client.js'

const referencePosition: [number, number, number] = [0, 0, 0]
const module = { name: 'Power Plant', class: 6, rating: 'A', ed_symbol: 'Int_PowerPlant_Size6_Class5' }
const base = {
  name: 'Facility', system_name: 'Nearby', material_trader: 'Raw', services: [{ name: 'Vista Genomics' }],
  modules: [module], outfitting_updated_at: '2026-10-04T08:00:00Z'
}

test.each([1, 2])('all station searches find eligible size %i pads after 100 unsuitable candidates', async minimumPadSize => {
  const rows = [
    ...Array.from({ length: 100 }, (_, index) => ({ ...base, name: `Facility ${index}`, distance: index + 1, ...(minimumPadSize === 2 ? { small_pads: 1 } : {}) })),
    { ...base, distance: 102, name: 'Facility medium', medium_pads: 1 },
    { ...base, distance: 101, name: 'Facility large', has_large_pad: true },
    { ...base, distance: 103, name: 'Facility small', small_pads: 1 }
  ]
  const search = vi.fn(async (_index: unknown, request: SpanshSearchRequest) => rows
    .filter(row => !request.filters.has_large_pad || 'has_large_pad' in row)
    .filter(row => !request.filters.medium_pads || 'medium_pads' in row)
    .filter(row => !request.filters.small_pads || 'small_pads' in row)
    .sort((left, right) => left.distance - right.distance).slice(0, 100))
  const gateway: SpanshSearchGateway = { search, findFieldValues: async () => rows.map(row => row.name) }
  const expected = minimumPadSize === 2 ? ['Facility large', 'Facility medium'] : ['Facility large', 'Facility medium', 'Facility small']
  const sources = [
    () => new SpanshMaterialTraderSource(gateway).findMaterialTraders({ minimumPadSize, referencePosition, traderType: 'Raw' }),
    () => new SpanshStationServiceSource(gateway).findStationsWithService({ minimumPadSize, referencePosition, service: 'Vista Genomics' }),
    () => new SpanshStationLookupSource(gateway).findStations({ minimumPadSize, referencePosition, name: 'Facility', stationType: 'any', maxDistanceLy: null }),
    () => new SpanshOutfittingSearchSource(gateway).findOutfitting({
      minimumPadSize, referencePosition, maxDistanceLy: 500, moduleClass: 6, moduleRating: 'A', moduleName: 'Power Plant',
      reportedAfter: '2026-10-01T00:00:00Z', reportedBefore: '2026-10-04T12:00:00Z'
    })
  ]
  for (const run of sources) {
    search.mockClear()
    expect((await run()).map(station => station.stationName)).toEqual(expected)
    expect(search).toHaveBeenCalledTimes(minimumPadSize === 2 ? 2 : 3)
    expect(search.mock.calls[1]?.[1].filters.medium_pads).toEqual({ comparison: '>=', value: 1 })
  }
})

test('overlapping pad searches deduplicate identities without discarding module variants', async () => {
  const rows = [
    { ...base, distance: 3, market_id: 42, id: '42', medium_pads: 1, has_large_pad: true },
    { ...base, name: 'Without market ID', distance: 4, id: '99', medium_pads: 1, has_large_pad: true },
    { ...base, name: 'Without IDs', distance: 5, medium_pads: 1, has_large_pad: true }
  ]
  const extraModule = { ...module, class: 5, ed_symbol: 'Int_PowerPlant_Size5_Class5' }
  const search = vi.fn(async (_index: unknown, request: SpanshSearchRequest) => request.filters.has_large_pad ? rows : rows.map(row => ({ ...row, modules: [extraModule] })))
  const result = await searchSpanshStations({ search, findFieldValues: async () => [] }, { filters: {}, referencePosition }, 2)
  expect(result).toHaveLength(3)
  expect(result).toMatchObject(rows.map(row => ({ ...row, modules: [module, extraModule] })))
})

test('pad union stays bounded and sorts the combined nearest candidates', async () => {
  const large = Array.from({ length: 100 }, (_, index) => ({ ...base, name: `Large ${index}`, distance: 2 * index + 1, has_large_pad: true }))
  const medium = Array.from({ length: 100 }, (_, index) => ({ ...base, name: `Medium ${index}`, distance: 2 * index + 2, medium_pads: 1 }))
  let active = 0
  let maximumActive = 0
  const search = vi.fn(async (_index: unknown, request: SpanshSearchRequest) => {
    active += 1
    maximumActive = Math.max(maximumActive, active)
    await Promise.resolve()
    active -= 1
    return request.filters.has_large_pad ? large : request.filters.medium_pads ? medium : []
  })
  const result = await searchSpanshStations({ search, findFieldValues: async () => [] }, { filters: {}, referencePosition }, 1)
  expect(result).toHaveLength(100)
  expect(result.map(row => (row as { distance: number }).distance)).toEqual(Array.from({ length: 100 }, (_, index) => index + 1))
  expect(search).toHaveBeenCalledTimes(3)
  expect(maximumActive).toBe(3)
})

test('provider failures reject the complete query and missing pad claims never qualify', async () => {
  const missingPads = { ...base, distance: 1 }
  const gateway: SpanshSearchGateway = {
    findFieldValues: async () => [],
    search: async (_index, request) => {
      if (request.filters.medium_pads) throw new Error('Medium branch failed')
      return [missingPads]
    }
  }
  await expect(searchSpanshStations(gateway, { filters: {}, referencePosition }, 2)).rejects.toThrow('Medium branch failed')
  gateway.search = async () => [missingPads]
  expect(await searchSpanshStations(gateway, { filters: {}, referencePosition }, 1)).toEqual([])
})
