import { describe, expect, it, vi } from 'vitest'
import { createEmptyRuntimeState, type CartographicSystem } from '@phoenix/contracts'
import { DefaultExplorationTargetQuery, type ExplorationTargetSearchInput } from '../apps/server/src/application/default-exploration-target-query.js'
import type { SystemCartography } from '../apps/server/src/domain/cartography.js'
import type { ExplorationTargetSearchSource } from '../apps/server/src/domain/exploration-target.js'
import type { ProviderCacheEntry, ProviderResponseCache } from '../apps/server/src/domain/station-market.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { SpanshExplorationTargetSource } from '../apps/server/src/infrastructure/spansh-exploration-target-source.js'
import { SpanshSearchClient, type SpanshSearchGateway } from '../apps/server/src/infrastructure/spansh-search-client.js'

describe('exploration target search', () => {
  it('pre-Odyssey filters include the cutoff day without excluding old non-landable or unreported bodies', async () => {
    const search = vi.fn<SpanshSearchGateway['search']>(async () => [{
      name: 'Old record 1', system_name: 'Old record', distance: 10, is_landable: false,
      surface_temperature: 180, subtype: 'High metal content world'
    }])
    const source = new SpanshExplorationTargetSource({ search, findFieldValues: vi.fn() })
    const result = await source.findTargets({
      ...searchInput(), referencePosition: [0, 0, 0], lastReportedBefore: '2021-05-18',
      minTemperatureK: 165, bodySubtypes: ['High metal content world']
    })
    const filters = search.mock.calls[0]![1].filters
    expect(filters).not.toHaveProperty('is_landable')
    expect(filters).not.toHaveProperty('signals')
    expect(filters).toMatchObject({ updated_at: { comparison: '<=>', value: ['2014-12-16T00:00:00.000Z', '2021-05-18T23:59:59.999Z'] } })
    expect(result[0]).toMatchObject({ landable: false, biologicalSignals: null, geologicalSignals: null })
  })
  it.each([
    [undefined, null, null],
    [[], null, null],
    [[{ name: 'Biological', count: 0 }], 0, null],
    [[{ name: 'Geological', count: 0 }], null, 0],
    [[{ name: 'Biological', count: 3 }, { name: 'Geological', count: 2 }], 3, 2],
    [[{ name: 'Biological' }, { name: 'Geological', count: -1 }], null, null]
  ])('preserves absent versus explicit signal counts from %j', async (signals, biological, geological) => {
    const source = new SpanshExplorationTargetSource(new SpanshSearchClient({
      fetch: vi.fn(async () => response({ results: [{ name: 'Test 1', system_name: 'Test', distance: 2, signals }] }))
    }))
    const [result] = await source.findTargets({ ...searchInput(), referencePosition: [0, 0, 0] })
    expect(result).toMatchObject({ biologicalSignals: biological, geologicalSignals: geological })
  })

  it('retains unreported signals without a minimum, including cached results and Copilot text', async () => {
    const findTargets = vi.fn(async () => [target({ biologicalSignals: null, geologicalSignals: null })])
    const service = new DefaultExplorationTargetQuery({ findTargets }, cartography(), new InMemoryRuntimeStateStore(), cache())
    const input = searchInput()
    expect((await service.searchExplorationTargets(input)).targets[0]).toMatchObject({ biologicalSignals: null, geologicalSignals: null })
    expect((await service.searchExplorationTargets(input)).cache).toBe('fresh')
    expect(findTargets).toHaveBeenCalledTimes(1)
    const copilot = await service.searchTargets({ systemName: 'Sol', maxDistance: 500 })
    expect(JSON.stringify(copilot.content)).toContain('biological signals: not reported / geological signals: not reported')
    expect((await service.searchExplorationTargets({ ...input, minGeologicalSignals: 1 })).targets).toEqual([])
  })

  it('sends supported physical, signal, and report-date filters and maps returned evidence', async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => response({ results: [{
      atmosphere: 'Thin Carbon dioxide', body_id: 4, distance: 12.5, distance_to_arrival: 900,
      gravity: 0.21, is_landable: true, name: 'Test A 4', signals: [{ name: 'Biological', count: 3 }, { name: 'Geological', count: 1 }],
      signals_updated_at: '2026-08-15T12:00:00Z', subtype: 'Rocky body', surface_temperature: 210,
      system_id64: 42, system_name: 'Test', type: 'Planet', updated_at: '2026-08-15T11:00:00Z', volcanism_type: 'Minor Silicate Vapour Geysers'
    }] }))
    const source = new SpanshExplorationTargetSource(new SpanshSearchClient({ fetch: fetcher as typeof fetch }))

    const result = await source.findTargets({
      atmospheres: ['Thin Carbon dioxide', 'Thin Ammonia'], bodySubtypes: ['Rocky body', 'High metal content world'], landable: 'yes', lastReportedBefore: '2021-05-19', maxDistanceLy: 50,
      maxGravityG: 0.5, maxTemperatureK: 240, minGravityG: 0.1, minTemperatureK: 165,
      minBiologicalSignals: 2, minGeologicalSignals: 1, referencePosition: [1, 2, 3], volcanismTypes: []
    })

    expect(result[0]).toMatchObject({ biologicalSignals: 3, geologicalSignals: 1, bodyName: 'Test A 4', systemName: 'Test' })
    const payload = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))
    expect(payload.filters).toMatchObject({
      atmosphere: { value: ['Thin Carbon dioxide', 'Thin Ammonia'] }, distance: { min: 0, max: 50 }, gravity: { comparison: '<=>', value: [0.1, 0.5] },
      is_landable: { value: true }, signals: [
        { comparison: '<=>', count: [2, 100], name: 'Biological' },
        { comparison: '<=>', count: [1, 100], name: 'Geological' }
      ], subtype: { value: ['Rocky body', 'High metal content world'] }, surface_temperature: { comparison: '<=>', value: [165, 240] },
      updated_at: { comparison: '<=>', value: ['2014-12-16T00:00:00.000Z', '2021-05-19T23:59:59.999Z'] }
    })
  })

  it.each([
    [null, null, undefined],
    [165, null, { comparison: '>=', value: 165 }],
    [null, 240, { comparison: '<=', value: 240 }],
    [165, 240, { comparison: '<=>', value: [165, 240] }],
    [0, null, { comparison: '>=', value: 0 }],
    [null, 0, { comparison: '<=', value: 0 }],
    [0, 0, { comparison: '<=>', value: [0, 0] }]
  ])('encodes numeric bounds %s to %s using the Spansh comparison contract', async (min, max, expected) => {
    const search = vi.fn<SpanshSearchGateway['search']>(async () => [])
    const source = new SpanshExplorationTargetSource({ search, findFieldValues: vi.fn() })
    await source.findTargets({
      ...searchInput(), referencePosition: [0, 0, 0],
      minTemperatureK: min, maxTemperatureK: max, minGravityG: min, maxGravityG: max
    })
    const filters = search.mock.calls[0]?.[1].filters
    expect(filters?.surface_temperature).toEqual(expected)
    expect(filters?.gravity).toEqual(expected)
  })

  it('rejects out-of-range or unknown constrained values and keeps inclusive boundaries', async () => {
    const source: ExplorationTargetSearchSource = { findTargets: vi.fn(async () => [
      target({ bodyName: 'Lower boundary', surfaceTemperatureK: 165, gravityG: 0.1 }),
      target({ bodyName: 'Upper boundary', surfaceTemperatureK: 240, gravityG: 0.5 }),
      target({ surfaceTemperatureK: 162 }),
      target({ surfaceTemperatureK: 241 }),
      target({ surfaceTemperatureK: null }),
      target({ gravityG: 0.09 }),
      target({ gravityG: 0.51 }),
      target({ gravityG: null })
    ]) }
    const service = new DefaultExplorationTargetQuery(source, cartography(), new InMemoryRuntimeStateStore(), cache())
    const result = await service.searchExplorationTargets({
      ...searchInput(), minTemperatureK: 165, maxTemperatureK: 240, minGravityG: 0.1, maxGravityG: 0.5
    })
    expect(result.candidatesExamined).toBe(8)
    expect(result.targets.map(row => row.bodyName)).toEqual(['Lower boundary', 'Upper boundary'])
    const unconstrained = await service.searchExplorationTargets(searchInput())
    expect(unconstrained.targets).toHaveLength(8)
  })

  it('ignores old-format cached results, including as a stale fallback, and caches corrected queries', async () => {
    const storage = cache()
    const input = searchInput()
    const { systemName, ...filters } = input
    const key = JSON.stringify(Object.fromEntries(Object.entries({
      ...filters, referencePosition: [0, 0, 0], systemName
    }).sort(([left], [right]) => left.localeCompare(right))))
    storage.putProviderResponse('spansh-exploration-targets', key, new Date().toISOString(), [target({ bodyName: 'Old result' })])
    storage.putProviderResponse('spansh-exploration-targets-v2', key, new Date().toISOString(), [target({ bodyName: 'Collapsed signal counts' })])
    const findTargets = vi.fn<ExplorationTargetSearchSource['findTargets']>()
      .mockRejectedValueOnce(new Error('Provider unavailable'))
      .mockResolvedValue([target({ bodyName: 'Corrected result' })])
    const service = new DefaultExplorationTargetQuery({ findTargets }, cartography(), new InMemoryRuntimeStateStore(), storage)
    await expect(service.searchExplorationTargets(input)).rejects.toThrow('Provider unavailable')
    expect((await service.searchExplorationTargets(input)).targets[0]?.bodyName).toBe('Corrected result')
    expect((await service.searchExplorationTargets(input)).cache).toBe('fresh')
    expect(findTargets).toHaveBeenCalledTimes(2)
  })

  it('defensively rechecks signal counts returned by the provider', async () => {
    const source: ExplorationTargetSearchSource = { findTargets: vi.fn(async () => [
      target({ biologicalSignals: 0, bodyId: 1, bodyName: 'Test 1' }),
      target({ biologicalSignals: 2, bodyId: 2, bodyName: 'Test 2' }),
      target({ biologicalSignals: null, bodyId: 3, bodyName: 'Unreported' })
    ]) }
    const service = new DefaultExplorationTargetQuery(source, cartography(), new InMemoryRuntimeStateStore(), cache())
    const result = await service.searchExplorationTargets({
      atmospheres: [], bodySubtypes: [], landable: 'any', lastReportedBefore: null, maxDistanceLy: 100, maxGravityG: null, maxTemperatureK: null,
      minBiologicalSignals: 1, minGeologicalSignals: 0, minGravityG: null, minTemperatureK: null, systemName: 'Sol', volcanismTypes: []
    })

    expect(result.candidatesExamined).toBe(3)
    expect(result.targets).toHaveLength(1)
    expect(result.targets[0]).toMatchObject({ bodyName: 'Test 2' })
    expect(result.caveat).toContain('no result proves')
  })

  it('returns up to 100 interactive results while keeping Copilot output bounded', async () => {
    const source: ExplorationTargetSearchSource = {
      findTargets: vi.fn(async () => Array.from({ length: 100 }, (_, index) => target({
        bodyId: index + 1,
        bodyName: `Test ${index + 1}`
      })))
    }
    const service = new DefaultExplorationTargetQuery(source, cartography(), new InMemoryRuntimeStateStore(), cache())

    const result = await service.searchExplorationTargets({
      atmospheres: [], bodySubtypes: [], landable: 'any', lastReportedBefore: null, maxDistanceLy: 100, maxGravityG: null, maxTemperatureK: null,
      minBiologicalSignals: 0, minGeologicalSignals: 0, minGravityG: null, minTemperatureK: null, systemName: 'Sol', volcanismTypes: []
    })

    expect(result.targets).toHaveLength(100)

    const copilotResult = await service.searchTargets({ limit: 100, systemName: 'Sol' })
    expect((copilotResult.structuredContent as { targets: unknown[] }).targets).toHaveLength(20)
  })

  it('uses current journal coordinates without requiring an EDSM record', async () => {
    const source: ExplorationTargetSearchSource = { findTargets: vi.fn(async () => []) }
    const external = cartography()
    const state = createEmptyRuntimeState()
    state.system = { ...state.system, name: 'Smoje ZS-I c10-1', position: [123, -45, 678] }
    const runtime = new InMemoryRuntimeStateStore()
    runtime.replace(state)
    const service = new DefaultExplorationTargetQuery(source, external, runtime, cache())

    const result = await service.searchExplorationTargets({
      atmospheres: [], bodySubtypes: [], landable: 'yes', lastReportedBefore: null, maxDistanceLy: 100, maxGravityG: null, maxTemperatureK: null,
      minBiologicalSignals: 1, minGeologicalSignals: 0, minGravityG: null, minTemperatureK: null, systemName: 'smoje zs-i C10-1', volcanismTypes: []
    })

    expect(external.getSystem).not.toHaveBeenCalled()
    expect(source.findTargets).toHaveBeenCalledWith(expect.objectContaining({ referencePosition: [123, -45, 678] }))
    expect(result.originSystem).toBe('Smoje ZS-I c10-1')
  })
})

function target (override: Partial<Awaited<ReturnType<ExplorationTargetSearchSource['findTargets']>>[number]> = {}) {
  return { atmosphere: null, biologicalSignals: 0, bodyId: 1, bodyName: 'Test 1', bodyType: 'Planet', distanceLy: 2,
    distanceToArrivalLs: 100, geologicalSignals: 0, gravityG: 0.2, landable: true, providerUpdatedAt: null,
    signalsUpdatedAt: null, subtype: 'Rocky body', surfaceTemperatureK: 200, systemAddress: 42, systemName: 'Test', volcanism: null, ...override }
}
function searchInput (): ExplorationTargetSearchInput {
  return { atmospheres: [], bodySubtypes: [], landable: 'any', lastReportedBefore: null, maxDistanceLy: 500,
    maxGravityG: null, maxTemperatureK: null, minBiologicalSignals: 0, minGeologicalSignals: 0,
    minGravityG: null, minTemperatureK: null, systemName: 'Sol', volcanismTypes: [] }
}
function cartography (): SystemCartography { return { getSystem: vi.fn<SystemCartography['getSystem']>(async () => ({ cache: 'fresh', system: { name: 'Sol', position: [0, 0, 0] } as CartographicSystem })) } }
function cache (): ProviderResponseCache { const entries = new Map<string, ProviderCacheEntry>(); return { getProviderResponse: (namespace, key) => entries.get(`${namespace}:${key}`) ?? null, putProviderResponse: (namespace, key, fetchedAt, value) => { entries.set(`${namespace}:${key}`, { fetchedAt, value }) } } }
function response (body: unknown): Response { return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status: 200 }) }
