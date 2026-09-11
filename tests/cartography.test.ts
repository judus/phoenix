import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test, vi } from 'vitest'
import { createEmptyRuntimeState, type CartographicSystem, type CartographyUpdate } from '@phoenix/contracts'
import { SystemCartographyService } from '../apps/server/src/application/system-cartography-service.js'
import { CartographyObservationIngestionService } from '../apps/server/src/application/cartography-observation-ingestion-service.js'
import type { CartographyRecord, CartographyRepository, ExternalCartographySource, LocalSystemCartographyObservation } from '../apps/server/src/domain/cartography.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { EdsmCartographySource } from '../apps/server/src/infrastructure/edsm-cartography-source.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { InProcessPublisher } from '../apps/server/src/infrastructure/in-process-publisher.js'

test('EDSM cartography loads system, bodies, and stations concurrently into one lossless aggregate', async () => {
  const pending: Array<() => void> = []
  const fetcher = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString())
    await new Promise<void>(resolve => pending.push(resolve))
    if (url.pathname.endsWith('/bodies')) return response({ name: 'Sol', id64: 10477373803, bodies: [{ id: 1, id64: 2, bodyId: 0, name: 'Sol', type: 'Star', subType: 'G (White-Yellow) Star', surfaceGravity: 27.94, surfaceTemperature: 5_778, radius: 695_700, rings: [], discovery: { commander: 'hedge_' }, customField: 'retained' }] })
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
    bodies: [{ name: 'Sol', gravityGs: 27.94, surfaceTemperatureKelvin: 5_778, radiusKilometres: 695_700, ringed: false, firstDiscoveredBy: 'hedge_', firstFootfallBy: null, firstMappedBy: null, raw: { customField: 'retained' } }],
    stations: [{ name: 'Galileo', facilities: { market: true, shipyard: true }, services: ['Repair'] }]
  })
})

test('missing external cartography is reported without exposing the provider', async () => {
  const source = new EdsmCartographySource({
    fetch: vi.fn(async () => response({})) as typeof fetch
  })

  await expect(source.fetchSystem('Unreported System')).rejects.toThrow(
    'No cartography record for "Unreported System".'
  )
})

test('cartography repository preserves external and local source data in one system record', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const system = fixtureSystem()
    const observation = fixtureObservation('Sol')
    database.putExternalSystem(system)
    database.putLocalObservation(observation)
    expect(database.findRecord('  SOL ')).toEqual({ external: system, local: observation, systemName: 'Sol' })
    expect(database.listObservedRecords()).toEqual([{ external: system, local: observation, systemName: 'Sol' }])
  } finally {
    database.close()
  }
})

test('database migration combines legacy cartography tables and removes them', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-cartography-migration-'))
  const path = join(directory, 'phoenix.sqlite')
  const external = fixtureSystem()
  const { provenance: _provenance, ...legacyFields } = external
  const legacyExternal = {
    ...legacyFields,
    schemaVersion: 1,
    source: { provider: 'edsm', fetchedAt: external.provenance.edsm!.fetchedAt }
  }
  const local = fixtureObservation('Sol')
  const legacy = new DatabaseSync(path)
  legacy.exec(`
    CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL) STRICT;
    CREATE TABLE cartographic_systems (system_key TEXT PRIMARY KEY, system_name TEXT NOT NULL, fetched_at TEXT NOT NULL, document TEXT NOT NULL) STRICT;
    CREATE TABLE cartographic_observations (system_key TEXT PRIMARY KEY, system_name TEXT NOT NULL, updated_at TEXT NOT NULL, document TEXT NOT NULL) STRICT;
  `)
  legacy.prepare('INSERT INTO cartographic_systems VALUES (?, ?, ?, ?)').run('sol', 'Sol', external.provenance.edsm!.fetchedAt, JSON.stringify(legacyExternal))
  legacy.prepare('INSERT INTO cartographic_observations VALUES (?, ?, ?, ?)').run('sol', 'Sol', local.updatedAt, JSON.stringify(local))
  legacy.close()

  const database = new SqliteDatabase(path)
  try {
    database.initialize()
    expect(database.findRecord('Sol')).toEqual({ external, local, systemName: 'Sol' })
  } finally {
    database.close()
  }
  const migrated = new DatabaseSync(path)
  try {
    const tables = migrated.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'cartographic_%' ORDER BY name").all()
    expect(tables).toEqual([])
    expect(migrated.prepare('SELECT version FROM schema_migrations WHERE version = 11').get()).toEqual({ version: 11 })
    expect(migrated.prepare('SELECT version FROM schema_migrations WHERE version = 12').get()).toEqual({ version: 12 })
    expect(migrated.prepare('SELECT version FROM schema_migrations WHERE version = 15').get()).toEqual({ version: 15 })
  } finally {
    migrated.close()
    rmSync(directory, { force: true, recursive: true })
  }
})

test('database migration normalizes existing unified cartography documents once', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-cartography-body-migration-'))
  const path = join(directory, 'phoenix.sqlite')
  const current = fixtureSystem()
  const transitional = {
    ...current,
    schemaVersion: 2,
    bodies: [{
      id: 1,
      id64: 2,
      bodyId: 1,
      name: 'Sol A 1',
      type: 'Planet',
      subType: 'Rocky body',
      distanceToArrival: 120,
      parents: [{ Star: 0 }],
      local: null,
      raw: { isLandable: true, gravity: 0.5, surfaceTemperature: 280, radius: 6_000, atmosphereType: 'No atmosphere', rings: [{ name: 'A Ring' }], discovery: { commander: 'Other CMDR' } }
    }]
  }
  const local = {
    ...fixtureObservation('Sol'),
    bodies: [{
      bodyId: 1,
      bodyName: 'Sol A 1',
      bodySignals: null,
      discovered: false,
      footfalled: false,
      mapped: false,
      observedAt: '2026-08-11T12:02:00.000Z',
      organicSamples: [],
      scan: { event: 'Scan', WasDiscovered: false, WasMapped: false },
      surfaceScanCompleted: true,
      surfaceSignals: null
    }]
  }
  const legacy = new DatabaseSync(path)
  legacy.exec(`
    CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL) STRICT;
    INSERT INTO schema_migrations VALUES (11, datetime('now'));
    CREATE TABLE cartography_records (
      system_key TEXT PRIMARY KEY,
      system_name TEXT NOT NULL,
      external_fetched_at TEXT,
      local_updated_at TEXT,
      external_document TEXT,
      local_document TEXT,
      CHECK (external_document IS NOT NULL OR local_document IS NOT NULL),
      CHECK ((external_fetched_at IS NULL) = (external_document IS NULL)),
      CHECK ((local_updated_at IS NULL) = (local_document IS NULL))
    ) STRICT;
  `)
  legacy.prepare('INSERT INTO cartography_records VALUES (?, ?, ?, ?, ?, ?)').run(
    'sol',
    'Sol',
    current.provenance.edsm!.fetchedAt,
    local.updatedAt,
    JSON.stringify(transitional),
    JSON.stringify(local)
  )
  legacy.close()

  const database = new SqliteDatabase(path)
  try {
    database.initialize()
    expect(database.findRecord('Sol')?.external?.bodies[0]).toMatchObject({
      landable: true,
      gravityGs: 0.5,
      surfaceTemperatureKelvin: 280,
      radiusKilometres: 6_000,
      atmosphere: 'No atmosphere',
      ringed: true,
      firstDiscoveredBy: 'Other CMDR',
      firstFootfallBy: null,
      firstMappedBy: null
    })
    expect(database.findRecord('Sol')?.local?.bodies[0]).toMatchObject({
      previouslyDiscovered: false,
      previouslyFootfalled: false,
      previouslyMapped: false,
      surfaceScanCompleted: true
    })
    expect(database.findRecord('Sol')?.local?.bodies[0]).not.toHaveProperty('discovered')
    expect(database.findRecord('Sol')?.local?.bodies[0]).not.toHaveProperty('mapped')
    const migrated = new DatabaseSync(path, { readOnly: true })
    try {
      expect(migrated.prepare('SELECT version FROM schema_migrations WHERE version = 13').get()).toEqual({ version: 13 })
      expect(migrated.prepare('SELECT version FROM schema_migrations WHERE version = 14').get()).toEqual({ version: 14 })
      expect(migrated.prepare('SELECT version FROM schema_migrations WHERE version = 15').get()).toEqual({ version: 15 })
    } finally {
      migrated.close()
    }
  } finally {
    database.close()
    rmSync(directory, { force: true, recursive: true })
  }
})

test('cached cartography coalesces concurrent refreshes and falls back to stale data', async () => {
  const repository = new MemoryRepository()
  const source: ExternalCartographySource = { fetchSystem: vi.fn(async () => fixtureSystem()) }
  const runtime = new InMemoryRuntimeStateStore()
  const service = new SystemCartographyService(source, repository, runtime, 0, () => new Date('2026-08-12T12:00:00.000Z'))

  await Promise.all([service.getSystem('Sol'), service.getSystem('sol')])
  expect(source.fetchSystem).toHaveBeenCalledTimes(1)

  const unavailable: ExternalCartographySource = { fetchSystem: async () => { throw new Error('offline') } }
  const fallback = await new SystemCartographyService(unavailable, repository, runtime, 0, () => new Date('2026-08-13T12:00:00.000Z')).getSystem('Sol')
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
  const cartographyUpdates = new InProcessPublisher<CartographyUpdate>()
  const updates: CartographyUpdate[] = []
  cartographyUpdates.subscribe(update => updates.push(update))
  const ingestion = new CartographyObservationIngestionService(database, runtime, cartographyUpdates)
  const system = fixtureSystem()
  database.putExternalSystem(system)
  ingestion.ingest({ timestamp: '2026-08-11T12:01:00Z', event: 'FSSDiscoveryScan', SystemName: 'Sol', SystemAddress: 10477373803, BodyCount: 2 })
  ingestion.ingest({ timestamp: '2026-08-11T12:01:30Z', event: 'Disembark', StarSystem: 'Sol', Body: 'Galileo', BodyID: 36, OnPlanet: false })
  ingestion.ingest({
    timestamp: '2026-08-11T12:02:00Z',
    event: 'Scan',
    ScanType: 'Detailed',
    BodyName: 'Sol A 1',
    BodyID: 1,
    PlanetClass: 'Rocky body',
    DistanceFromArrivalLS: 120,
    WasDiscovered: false,
    WasMapped: false,
    WasFootfalled: false,
    Landable: true,
    TidalLock: false,
    TerraformState: '',
    Volcanism: '',
    MassEM: 1,
    SurfaceGravity: 9.80665,
    SurfaceTemperature: 288,
    SurfacePressure: 101_325,
    Radius: 6_371_000,
    AtmosphereType: 'Suitable for water-based life',
    AtmosphereComposition: [{ Name: 'Nitrogen', Percent: 78 }],
    Materials: [{ Name: 'iron', Percent: 20.1 }],
    Composition: { Ice: 0.1, Rock: 0.7, Metal: 0.2 },
    SemiMajorAxis: 149_597_870_700,
    OrbitalPeriod: 31_557_600,
    RotationPeriod: 86_164,
    AxialTilt: 0.4091,
    Rings: [{ Name: 'Sol A 1 A Ring', RingClass: 'eRingClass_Rocky', InnerRad: 7_000_000, OuterRad: 8_000_000, MassMT: 100 }]
  })
  ingestion.ingest({ timestamp: '2026-08-11T12:02:30Z', event: 'Disembark', StarSystem: 'Sol', Body: 'Sol A 1', BodyID: 1, OnPlanet: true })
  ingestion.ingest({
    timestamp: '2026-08-11T12:03:00Z',
    event: 'SAASignalsFound',
    BodyName: 'Sol A 1',
    Signals: [{ Type: '$SAA_SignalType_Biological;', Count: 3 }],
    Genuses: [{ Genus_Localised: 'Bacterium' }]
  })
  ingestion.ingest({
    timestamp: '2026-08-11T12:03:05Z', event: 'ScanOrganic', SystemAddress: 10477373803, Body: 1,
    ScanType: 'Sample', Genus: '$Bacterial;', Genus_Localised: 'Bacterium',
    Species: '$Bacterial_01;', Species_Localised: 'Bacterium Aurasus',
    Variant: '$Bacterial_01_F;', Variant_Localised: 'Bacterium Aurasus - Lime'
  })
  ingestion.ingest({
    timestamp: '2026-08-11T12:03:10Z', event: 'ScanOrganic', SystemAddress: 10477373803, Body: 1,
    ScanType: 'Analyse', Genus: '$Bacterial;', Genus_Localised: 'Bacterium',
    Species: '$Bacterial_01;', Species_Localised: 'Bacterium Aurasus',
    Variant: '$Bacterial_01_F;', Variant_Localised: 'Bacterium Aurasus - Lime'
  })
  const source: ExternalCartographySource = { fetchSystem: vi.fn(async () => system) }
  const cartography = new SystemCartographyService(source, database, runtime, 300_000, () => new Date('2026-08-11T12:03:30Z'))

  try {
    const result = await cartography.getSystem('Sol')
    expect(result.cache).toBe('fresh')
    expect(source.fetchSystem).not.toHaveBeenCalled()
    expect(result.system.scanProgress).toEqual({ knownBodies: 1, reportedBodies: 2, percent: 50 })
    expect(result.system.bodies.map(body => body.name)).toEqual(['Sol A 1'])
    expect(result.system.bodies[0]).toMatchObject({
      name: 'Sol A 1',
      type: 'Planet',
      subType: 'Rocky body',
      landable: true,
      gravityGs: 1,
      surfaceTemperatureKelvin: 288,
      radiusKilometres: 6_371,
      atmosphere: 'Suitable for water-based life',
      ringed: true,
      details: {
        atmosphereComposition: [{ name: 'Nitrogen', percent: 78 }],
        massEarths: 1,
        materials: [{ name: 'Iron', percent: 20.1 }],
        orbit: {
          axialTiltDegrees: expect.closeTo(23.44, 2),
          orbitalPeriodSeconds: 31_557_600,
          rotationPeriodSeconds: 86_164
        },
        rings: [{ name: 'Sol A 1 A Ring', type: 'Rocky', innerRadiusKilometres: 7_000, outerRadiusKilometres: 8_000, massMegatonnes: 100 }],
        scanType: 'Detailed',
        solidComposition: { icePercent: 10, rockPercent: 70, metalPercent: 20 },
        surfacePressurePascals: 101_325,
        terraformState: 'Not terraformable',
        tidallyLocked: false,
        volcanism: 'None'
      },
      local: {
        discovered: true,
        mapped: false,
        firstDiscoveredByCommander: true,
        firstMappedByCommander: false,
        signals: { biological: 3, geological: 0, human: 0 },
        biologicalGenuses: ['Bacterium'],
        organicSamples: [{
          genus: 'Bacterium', species: 'Bacterium Aurasus', variant: 'Bacterium Aurasus - Lime',
          completed: true, progress: 3, scanTypes: ['Sample', 'Analyse']
        }]
      }
    })
    expect(result.system.bodies[0]?.details.orbit.semiMajorAxisKilometres).toBeCloseTo(149_597_870.7)
    expect(updates.at(-1)?.system.bodies[0]?.local).toMatchObject({
      footfalled: true,
      previouslyFootfalled: false
    })
  } finally {
    database.close()
  }
})

test('cartography projection ignores legacy observations without body evidence', async () => {
  const repository = new MemoryRepository()
  const system = fixtureSystem()
  repository.putExternalSystem(system)
  repository.putLocalObservation({
    ...fixtureObservation('Sol'),
    bodies: [{
      bodyId: 36,
      bodyName: 'Galileo',
      bodySignals: null,
      footfallCompleted: false,
      previouslyDiscovered: null,
      previouslyFootfalled: null,
      previouslyMapped: null,
      observedAt: '2026-08-11T12:00:00.000Z',
      organicSamples: [],
      scan: null,
      surfaceScanCompleted: false,
      surfaceSignals: null
    }]
  })
  const runtime = new InMemoryRuntimeStateStore()
  const source: ExternalCartographySource = { fetchSystem: vi.fn(async () => system) }

  const result = await new SystemCartographyService(source, repository, runtime).getSystem('Sol')

  expect(result.system.bodies.map(body => body.name)).toEqual(system.bodies.map(body => body.name))
})

test('local journal cartography remains readable when EDSM has no system record', async () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  const runtime = new InMemoryRuntimeStateStore()
  const state = createEmptyRuntimeState()
  runtime.replace({
    ...state,
    system: { ...state.system, name: 'Smoje ZS-I c10-1', address: 77, position: [10, 20, 30] }
  })
  const ingestion = new CartographyObservationIngestionService(database, runtime, new InProcessPublisher<CartographyUpdate>())
  ingestion.ingest({ timestamp: '2026-08-11T13:00:00Z', event: 'FSSDiscoveryScan', SystemName: 'Smoje ZS-I c10-1', SystemAddress: 77, BodyCount: 1 })
  ingestion.ingest({ timestamp: '2026-08-11T13:01:00Z', event: 'Scan', BodyName: 'Smoje ZS-I c10-1 A', BodyID: 0, StarType: 'K', DistanceFromArrivalLS: 0, SurfaceGravity: 250, SurfaceTemperature: 4_500, Radius: 600_000_000, WasDiscovered: false, WasMapped: false })
  const source: ExternalCartographySource = { fetchSystem: vi.fn(async () => { throw new Error('EDSM has no record') }) }

  try {
    const result = await new SystemCartographyService(source, database, runtime).getSystem('Smoje ZS-I c10-1')
    expect(result.cache).toBe('local')
    expect(result.system).toMatchObject({
      name: 'Smoje ZS-I c10-1',
      address: 77,
      position: [10, 20, 30],
      bodies: [{ name: 'Smoje ZS-I c10-1 A', type: 'Star', subType: 'K', surfaceTemperatureKelvin: 4_500, radiusKilometres: 600_000 }],
      provenance: { edsm: null, journal: { updatedAt: '2026-08-11T13:01:00Z' } }
    })
  } finally {
    database.close()
  }
})

class MemoryRepository implements CartographyRepository {
  private readonly records = new Map<string, CartographyRecord>()
  public findRecord (systemName: string) { return this.records.get(systemName.trim().toLocaleLowerCase()) ?? null }
  public listObservedRecords () { return [...this.records.values()].filter(record => record.local !== null) }
  public putExternalSystem (system: CartographicSystem) {
    const key = system.name.toLocaleLowerCase()
    this.records.set(key, { external: system, local: this.records.get(key)?.local ?? null, systemName: system.name })
  }
  public putLocalObservation (local: LocalSystemCartographyObservation) {
    const key = local.systemName.toLocaleLowerCase()
    this.records.set(key, { external: this.records.get(key)?.external ?? null, local, systemName: local.systemName })
  }
}

function response (value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } })
}

function fixtureSystem (): CartographicSystem {
  return {
    schemaVersion: 5,
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
    provenance: { edsm: { fetchedAt: '2026-08-11T12:00:00.000Z' }, journal: null },
    raw: { system: { name: 'Sol' }, bodies: { bodies: [] }, stations: { stations: [] } }
  }
}

function fixtureObservation (systemName: string): LocalSystemCartographyObservation {
  return {
    allBodiesFound: false,
    bodies: [],
    reportedBodyCount: null,
    systemAddress: 10477373803,
    systemName,
    updatedAt: '2026-08-11T12:01:00.000Z'
  }
}
