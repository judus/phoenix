import { expect, test } from 'vitest'
import { createEmptyRuntimeState, type CartographicSystem } from '@phoenix/contracts'
import { CartographyObservationIngestionService } from '../apps/server/src/application/cartography-observation-ingestion-service.js'
import { DefaultExplorationBodyQuery } from '../apps/server/src/application/default-exploration-body-query.js'
import type { SystemCartography } from '../apps/server/src/domain/cartography.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'

test('current-body query combines live location, scans, signals, and organic sample progress', async () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  const runtime = new InMemoryRuntimeStateStore()
  const state = createEmptyRuntimeState()
  runtime.replace({
    ...state,
    system: { ...state.system, name: 'Test System', address: 42 },
    location: { state: 'on_foot', place: { kind: 'body', name: 'Test System 1', id: 1, type: 'Planet' } }
  })
  const ingestion = new CartographyObservationIngestionService(database, runtime)
  ingestion.ingest({
    timestamp: '2026-08-11T12:00:00Z', event: 'Scan', StarSystem: 'Test System', SystemAddress: 42,
    BodyName: 'Test System 1', BodyID: 1, PlanetClass: 'Rocky body', Atmosphere: 'thin ammonia atmosphere',
    Volcanism: 'minor silicate vapour geysers volcanism', WasDiscovered: false, WasMapped: false, WasFootfalled: false
  })
  ingestion.ingest({
    timestamp: '2026-08-11T12:01:00Z', event: 'SAASignalsFound', SystemAddress: 42, BodyName: 'Test System 1', BodyID: 1,
    Signals: [
      { Type: '$SAA_SignalType_Biological;', Count: 2 },
      { Type: '$SAA_SignalType_Geological;', Count: 1 }
    ],
    Genuses: [
      { Genus: '$Bacterial;', Genus_Localised: 'Bacterium' },
      { Genus: '$Tussocks;', Genus_Localised: 'Tussock' }
    ]
  })
  ingestion.ingest({
    timestamp: '2026-08-11T12:02:00Z', event: 'ScanOrganic', SystemAddress: 42, Body: 1,
    ScanType: 'Analyse', Genus: '$Bacterial;', Genus_Localised: 'Bacterium',
    Species: '$Bacterial_01;', Species_Localised: 'Bacterium Aurasus',
    Variant: '$Bacterial_01_F;', Variant_Localised: 'Bacterium Aurasus - Lime'
  })
  const query = new DefaultExplorationBodyQuery(database, cartography(), runtime)

  try {
    const result = await query.getCurrentBody({})
    expect(result.content[0]).toMatchObject({ text: expect.stringContaining('Bacterium Aurasus - Lime: complete') })
    expect(result.structuredContent).toMatchObject({
      currentBody: {
        name: 'Test System 1', status: 'on foot', discovered: 'No', mapped: 'No', footfalled: 'No',
        planetClass: 'Rocky body', atmosphere: 'thin ammonia atmosphere'
      },
      signalCounts: { biological: 2, geological: 1, human: 0 },
      samples: [
        { genus: 'Tussock', progress: 0, completed: false },
        { genus: 'Bacterium', progress: 3, completed: true }
      ]
    })
  } finally {
    database.close()
  }
})

test('current-body query reports an honest absence when telemetry has no body', async () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const result = await new DefaultExplorationBodyQuery(
      database,
      cartography(),
      new InMemoryRuntimeStateStore()
    ).getCurrentBody({})
    expect(result.structuredContent).toEqual({ currentBody: null })
  } finally {
    database.close()
  }
})

function cartography (): SystemCartography {
  return { getSystem: async () => ({ cache: 'fresh', system: fixtureSystem() }) }
}

function fixtureSystem (): CartographicSystem {
  return {
    schemaVersion: 1,
    name: 'Test System', address: 42, position: [1, 2, 3], permitRequired: null, permitName: null,
    information: { allegiance: null, government: null, security: null, state: null, primaryEconomy: null, secondaryEconomy: null, population: null, controllingFaction: null },
    primaryStar: null,
    bodies: [{ id: 1, id64: null, bodyId: 1, name: 'Test System 1', type: 'Planet', subType: 'Rocky body', distanceToArrival: 50, parents: [], local: null, raw: {} }],
    stations: [], scanProgress: { knownBodies: 1, reportedBodies: 1, percent: 100 }, localSystem: null,
    source: { provider: 'edsm', fetchedAt: '2026-08-11T12:00:00.000Z' }, raw: { system: {}, bodies: {}, stations: {} }
  }
}
