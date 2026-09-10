import { describe, expect, it, vi } from 'vitest'
import { createEmptyRuntimeState, type CartographicSystem } from '@phoenix/contracts'
import { DefaultExplorationTargetQuery } from '../apps/server/src/application/default-exploration-target-query.js'
import type { SystemCartography } from '../apps/server/src/domain/cartography.js'
import type { ExplorationTargetSearchSource } from '../apps/server/src/domain/exploration-target.js'
import type { ProviderCacheEntry, ProviderResponseCache } from '../apps/server/src/domain/station-market.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { SpanshExplorationTargetSource } from '../apps/server/src/infrastructure/spansh-exploration-target-source.js'

describe('exploration target search', () => {
  it('sends supported physical, signal, and report-date filters and maps returned evidence', async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => response({ results: [{
      atmosphere: 'Thin Carbon dioxide', body_id: 4, distance: 12.5, distance_to_arrival: 900,
      gravity: 0.21, is_landable: true, name: 'Test A 4', signals: [{ name: 'Biological', count: 3 }, { name: 'Geological', count: 1 }],
      signals_updated_at: '2026-08-15T12:00:00Z', subtype: 'Rocky body', surface_temperature: 210,
      system_id64: 42, system_name: 'Test', type: 'Planet', updated_at: '2026-08-15T11:00:00Z', volcanism_type: 'Minor Silicate Vapour Geysers'
    }] }))
    const source = new SpanshExplorationTargetSource({ fetch: fetcher as typeof fetch })

    const result = await source.findTargets({
      atmospheres: ['Thin Carbon dioxide', 'Thin Ammonia'], bodySubtypes: ['Rocky body', 'High metal content world'], landable: 'yes', lastReportedBefore: '2021-05-19', maxDistanceLy: 50,
      maxGravityG: 0.5, maxTemperatureK: 240, minGravityG: 0.1, minTemperatureK: 165,
      minBiologicalSignals: 2, minGeologicalSignals: 1, referencePosition: [1, 2, 3], volcanismTypes: []
    })

    expect(result[0]).toMatchObject({ biologicalSignals: 3, geologicalSignals: 1, bodyName: 'Test A 4', systemName: 'Test' })
    const payload = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))
    expect(payload.filters).toMatchObject({
      atmosphere: { value: ['Thin Carbon dioxide', 'Thin Ammonia'] }, distance: { min: 0, max: 50 }, gravity: { min: 0.1, max: 0.5 },
      is_landable: { value: true }, signals: [
        { comparison: '<=>', count: [2, 100], name: 'Biological' },
        { comparison: '<=>', count: [1, 100], name: 'Geological' }
      ], subtype: { value: ['Rocky body', 'High metal content world'] }, surface_temperature: { min: 165, max: 240 },
      updated_at: { comparison: '<=>', value: ['2014-12-16T00:00:00.000Z', '2021-05-19T23:59:59.999Z'] }
    })
  })

  it('defensively rechecks signal counts returned by the provider', async () => {
    const source: ExplorationTargetSearchSource = { findTargets: vi.fn(async () => [
      target({ biologicalSignals: 0, bodyId: 1, bodyName: 'Test 1' }),
      target({ biologicalSignals: 2, bodyId: 2, bodyName: 'Test 2' })
    ]) }
    const service = new DefaultExplorationTargetQuery(source, cartography(), new InMemoryRuntimeStateStore(), cache())
    const result = await service.searchExplorationTargets({
      atmospheres: [], bodySubtypes: [], landable: 'any', lastReportedBefore: null, maxDistanceLy: 100, maxGravityG: null, maxTemperatureK: null,
      minBiologicalSignals: 1, minGeologicalSignals: 0, minGravityG: null, minTemperatureK: null, systemName: 'Sol', volcanismTypes: []
    })

    expect(result.candidatesExamined).toBe(2)
    expect(result.targets).toHaveLength(1)
    expect(result.targets[0]).toMatchObject({ bodyName: 'Test 2' })
    expect(result.caveat).toContain('no result proves')
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
function cartography (): SystemCartography { return { getSystem: vi.fn(async () => ({ cache: 'fresh', system: { name: 'Sol', position: [0, 0, 0] } as CartographicSystem })) } }
function cache (): ProviderResponseCache { const entries = new Map<string, ProviderCacheEntry>(); return { getProviderResponse: (namespace, key) => entries.get(`${namespace}:${key}`) ?? null, putProviderResponse: (namespace, key, fetchedAt, value) => { entries.set(`${namespace}:${key}`, { fetchedAt, value }) } } }
function response (body: unknown): Response { return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status: 200 }) }
