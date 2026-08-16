import { describe, expect, it, vi } from 'vitest'
import { createEmptyRuntimeState, type CartographicSystem } from '@phoenix/contracts'
import { DefaultExplorationTargetQuery } from '../apps/server/src/application/default-exploration-target-query.js'
import type { ExplorationDataReader } from '../apps/server/src/application/exploration-data-service.js'
import type { SystemCartography } from '../apps/server/src/domain/cartography.js'
import type { ExplorationTargetSearchSource } from '../apps/server/src/domain/exploration-target.js'
import type { ProviderCacheEntry, ProviderResponseCache } from '../apps/server/src/domain/station-market.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { SpanshExplorationTargetSource } from '../apps/server/src/infrastructure/spansh-exploration-target-source.js'

describe('exploration target search', () => {
  it('sends only supported physical filters and maps returned signal evidence', async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => response({ results: [{
      atmosphere: 'Thin Carbon dioxide', body_id: 4, distance: 12.5, distance_to_arrival: 900,
      gravity: 0.21, is_landable: true, name: 'Test A 4', signals: [{ name: 'Biological', count: 3 }, { name: 'Geological', count: 1 }],
      signals_updated_at: '2026-08-15T12:00:00Z', subtype: 'Rocky body', surface_temperature: 210,
      system_id64: 42, system_name: 'Test', type: 'Planet', updated_at: '2026-08-15T11:00:00Z', volcanism_type: 'Minor Silicate Vapour Geysers'
    }] }))
    const source = new SpanshExplorationTargetSource({ fetch: fetcher as typeof fetch })

    const result = await source.findTargets({
      atmosphere: 'Thin Carbon dioxide', bodyType: 'Rocky body', landable: 'yes', maxDistanceLy: 50,
      maxGravityG: 0.5, maxTemperatureK: 240, minGravityG: 0.1, minTemperatureK: 165,
      referencePosition: [1, 2, 3], volcanism: null
    })

    expect(result[0]).toMatchObject({ biologicalSignals: 3, geologicalSignals: 1, bodyName: 'Test A 4', systemName: 'Test' })
    const payload = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))
    expect(payload.filters).toMatchObject({
      atmosphere: { value: ['Thin Carbon dioxide'] }, distance: { min: 0, max: 50 }, gravity: { min: 0.1, max: 0.5 },
      is_landable: { value: true }, subtype: { value: ['Rocky body'] }, surface_temperature: { min: 165, max: 240 }
    })
    expect(payload.filters).not.toHaveProperty('biological_signals')
    expect(payload.filters).not.toHaveProperty('geological_signals')
  })

  it('filters signal counts locally and separates exact local journal evidence', async () => {
    const source: ExplorationTargetSearchSource = { findTargets: vi.fn(async () => [
      target({ biologicalSignals: 0, bodyId: 1, bodyName: 'Test 1' }),
      target({ biologicalSignals: 2, bodyId: 2, bodyName: 'Test 2' })
    ]) }
    const service = new DefaultExplorationTargetQuery(source, cartography(), new InMemoryRuntimeStateStore(createEmptyRuntimeState()), exploration(), cache())
    const result = await service.searchExplorationTargets({
      atmosphere: null, bodyType: null, landable: 'any', maxDistanceLy: 100, maxGravityG: null, maxTemperatureK: null,
      minBiologicalSignals: 1, minGeologicalSignals: 0, minGravityG: null, minTemperatureK: null, systemName: 'Sol', volcanism: null
    })

    expect(result.candidatesExamined).toBe(2)
    expect(result.targets).toHaveLength(1)
    expect(result.targets[0]).toMatchObject({ bodyName: 'Test 2', localEvidence: { observed: true, mapped: true, biologicalSamplesCompleted: 1 } })
    expect(result.caveat).toContain('no result proves')
  })
})

function target (override: Partial<Awaited<ReturnType<ExplorationTargetSearchSource['findTargets']>>[number]> = {}) {
  return { atmosphere: null, biologicalSignals: 0, bodyId: 1, bodyName: 'Test 1', bodyType: 'Planet', distanceLy: 2,
    distanceToArrivalLs: 100, geologicalSignals: 0, gravityG: 0.2, landable: true, providerUpdatedAt: null,
    signalsUpdatedAt: null, subtype: 'Rocky body', surfaceTemperatureK: 200, systemAddress: 42, systemName: 'Test', volcanism: null, ...override }
}
function cartography (): SystemCartography { return { getSystem: vi.fn(async () => ({ cache: 'fresh', system: { name: 'Sol', position: [0, 0, 0] } as CartographicSystem })) } }
function exploration (): ExplorationDataReader { return { getLedger: () => ({ systems: [{ address: 42, allBodiesFound: false, bodies: [{
  atmosphere: null, biologicalGenuses: ['Bacterium'], biologicalSignals: [{ key: 'bacterium', name: 'Bacterium' }], bodyId: 2,
  discovered: true, footfalled: null, key: '42:2', manualBiologicalCompletions: [], mapped: true, name: 'Test 2', observedAt: '2026-08-15T12:00:00.000Z',
  organicSamples: [{ completed: true, genus: 'Bacterium', lastUpdated: '2026-08-15T12:00:00.000Z', progress: 3, scanTypes: ['Log'], species: 'Test', variant: 'Test' }],
  planetClass: 'Rocky body', scanned: true, signals: { biological: 2, geological: 0, human: 0 }, surfaceScanCompleted: true,
  systemAddress: 42, systemName: 'Test', volcanism: null
}], name: 'Test', reportedBodyCount: 2, updatedAt: '2026-08-15T12:00:00.000Z' }], totals: { biologicalSignals: 2, bodies: 1, geologicalSignals: 0, mappedBodies: 1, samplesCompleted: 1, scannedBodies: 1, systems: 1 } }), setBiologicalSignalManualCompletion: () => false } }
function cache (): ProviderResponseCache { const entries = new Map<string, ProviderCacheEntry>(); return { getProviderResponse: (namespace, key) => entries.get(`${namespace}:${key}`) ?? null, putProviderResponse: (namespace, key, fetchedAt, value) => { entries.set(`${namespace}:${key}`, { fetchedAt, value }) } } }
function response (body: unknown): Response { return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, status: 200 }) }
