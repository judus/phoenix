import { expect, test, vi } from 'vitest'
import { createEmptyRuntimeState, type CartographicSystem } from '@phoenix/contracts'
import { CachedSystemCartographyService } from '../apps/server/src/application/cached-system-cartography-service.js'
import { CartographyObservationIngestionService } from '../apps/server/src/application/cartography-observation-ingestion-service.js'
import type { CartographyCache, CartographySource } from '../apps/server/src/domain/cartography.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { EdsmCartographySource } from '../apps/server/src/infrastructure/edsm-cartography-source.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'

test('EDSM cartography loads system, bodies, and stations concurrently into one lossless aggregate', async () => {
  const pending: Array<() => void> = []
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString())
    await new Promise<void>(resolve => pending.push(resolve))
    if (url.pathname.endsWith('/bodies')) return response({ name: 'Sol', id64: 10477373803, bodies: [{ id: 1, id64: 2, bodyId: 0, name: 'Sol', type: 'Star', subType: 'G (White-Yellow) Star', customField: 'retained' }] })
    if (url.pathname.endsWith('/stations')) return response({ name: 'Sol', id64: 10477373803, stations: [{ id: 3, marketId: 128666762, name: 'Galileo', type: 'Coriolis Starport', haveMarket: true, haveShipyard: true, otherServices: ['Repair'] }] })
    return response({ name: 'Sol', id64: 10477373803, coords: { x: 0, y: 0, z: 0 }, information: { allegiance: 'Federation', population: 23000000000 }, primaryStar: { name: 'Sol', isScoopable: true } })
  })
  const source = new EdsmCartographySource({ fetch: fetcher as typeof fetch, now: () => new Date('2026-08-11T12:00:00.000Z') })
  const lookup = source.fetchSystem('Sol')

  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3))
  pending.splice(0).forEach(resolve => resolve())
  const system = await lookup

  expect(system).toMatchObject({
    name: 'Sol',
    position: [0, 0, 0],
    information: { allegiance: 'Federation', population: 23000000000 },
    bodies: [{ name: 'Sol', raw: { customField: 'retained' } }],
    stations: [{ name: 'Galileo', facilities: { market: true, shipyard: true }, services: ['Repair'] }]
  })
})

test('cartography cache persists complete system documents in SQLite', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const system = fixtureSystem()
    database.putSystem(system)
    expect(database.getSystem('  SOL ')).toEqual(system)
  } finally {
    database.close()
  }
})

test('cached cartography coalesces concurrent refreshes and falls back to stale data', async () => {
  const cache = new MemoryCache()
  const source: CartographySource = { fetchSystem: vi.fn(async () => fixtureSystem()) }
  const runtime = new InMemoryRuntimeStateStore()
  const service = new CachedSystemCartographyService(source, cache, runtime, null, 0, () => new Date('2026-08-12T12:00:00.000Z'))

  await Promise.all([service.getSystem('Sol'), service.getSystem('sol')])
  expect(source.fetchSystem).toHaveBeenCalledTimes(1)

  const unavailable: CartographySource = { fetchSystem: async () => { throw new Error('offline') } }
  const fallback = await new CachedSystemCartographyService(unavailable, cache, runtime, null, 0, () => new Date('2026-08-13T12:00:00.000Z')).getSystem('Sol')
  expect(fallback.cache).toBe('stale')
  expect(fallback.system.name).toBe('Sol')
})

test('local journal scans and signals overlay cached EDSM cartography', async () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  const runtime = new InMemoryRuntimeStateStore()
  const runtimeState = createEmptyRuntimeState()
  runtime.replace({
    ...runtimeState,
    system: { ...runtimeState.system, name: 'Sol', address: 10477373803, position: [0, 0, 0] }
  })
  const ingestion = new CartographyObservationIngestionService(database, runtime)
  const system = fixtureSystem()
  database.putSystem(system)
  ingestion.ingest({ timestamp: '2026-08-11T12:01:00Z', event: 'FSSDiscoveryScan', SystemName: 'Sol', SystemAddress: 10477373803, BodyCount: 2 })
  ingestion.ingest({ timestamp: '2026-08-11T12:02:00Z', event: 'Scan', BodyName: 'Sol A 1', BodyID: 1, PlanetClass: 'Rocky body', DistanceFromArrivalLS: 120, WasDiscovered: false, WasMapped: false })
  ingestion.ingest({
    timestamp: '2026-08-11T12:03:00Z',
    event: 'SAASignalsFound',
    BodyName: 'Sol A 1',
    Signals: [{ Type: '$SAA_SignalType_Biological;', Count: 3 }],
    Genuses: [{ Genus_Localised: 'Bacterium' }]
  })
  const source: CartographySource = { fetchSystem: vi.fn(async () => system) }
  const cartography = new CachedSystemCartographyService(source, database, runtime, database, 300_000, () => new Date('2026-08-11T12:03:30Z'))

  try {
    const result = await cartography.getSystem('Sol')
    expect(result.cache).toBe('fresh')
    expect(source.fetchSystem).not.toHaveBeenCalled()
    expect(result.system.scanProgress).toEqual({ knownBodies: 1, reportedBodies: 2, percent: 50 })
    expect(result.system.bodies[0]).toMatchObject({
      name: 'Sol A 1',
      type: 'Planet',
      subType: 'Rocky body',
      local: {
        discovered: false,
        mapped: false,
        signals: { biological: 3, geological: 0, human: 0 },
        biologicalGenuses: ['Bacterium']
      }
    })
  } finally {
    database.close()
  }
})

class MemoryCache implements CartographyCache {
  private system: CartographicSystem | null = null
  public getSystem () { return this.system }
  public putSystem (system: CartographicSystem) { this.system = system }
}

function response (value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } })
}

function fixtureSystem (): CartographicSystem {
  return {
    schemaVersion: 1,
    name: 'Sol',
    address: 10477373803,
    position: [0, 0, 0],
    permitRequired: null,
    permitName: null,
    information: { allegiance: 'Federation', government: 'Democracy', security: 'High', state: null, primaryEconomy: 'Service', secondaryEconomy: null, population: 23000000000, controllingFaction: null },
    primaryStar: null,
    bodies: [],
    stations: [],
    scanProgress: { knownBodies: 0, reportedBodies: null, percent: null },
    localSystem: null,
    source: { provider: 'edsm', fetchedAt: '2026-08-11T12:00:00.000Z' },
    raw: { system: { name: 'Sol' }, bodies: { bodies: [] }, stations: { stations: [] } }
  }
}
