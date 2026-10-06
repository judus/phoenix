import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from 'vitest'
import { FleetShipSchema, StoredModuleSchema, type FleetShip, type StoredModule } from '@phoenix/contracts'
import type { FleetRepository } from '../apps/server/src/domain/fleet.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { fleetFixture } from './fixtures/fleet-fixture.js'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'
import { SqliteFleetRepository } from '../apps/server/src/infrastructure/sqlite-fleet-repository.js'

function ship(id = 7, overrides: Partial<FleetShip> = {}): FleetShip {
  return FleetShipSchema.parse({ ...fleetFixture().ships[0], id, ...overrides })
}

function module(storageSlot = 9, overrides: Partial<StoredModule> = {}): StoredModule {
  const { definition: _definition, station: _station, engineering, ...stored } = fleetFixture().storedModules.items[0]!
  const { displayName: _displayName, ...recipe } = engineering!
  return StoredModuleSchema.parse({ ...stored, engineering: recipe, storageSlot, ...overrides })
}

function withDatabase(run: (database: SqliteDatabase, fleet: FleetRepository) => void) {
  const database = new SqliteDatabase(':memory:')
  try { database.initialize(); run(database, database.fleet) }
  finally { database.close() }
}

test('Fleet repository preserves missing values, ship upserts, ordering and read isolation', () => {
  withDatabase((_database, fleet) => {
    expect(fleet.getFleetShip(1)).toBeNull()
    expect(fleet.listFleetShips()).toEqual([])
    expect(fleet.listStoredModules()).toEqual([])
    expect(fleet.getFleetProjectionTimestamp('unknown')).toBeNull()
    fleet.putFleetShip(ship(8))
    fleet.putFleetShip(ship(7))
    fleet.putFleetShip(ship(9, { updatedAt: '2026-08-17T12:00:00Z' }))
    expect(fleet.listFleetShips().map(item => item.id)).toEqual([9, 7, 8])
    const updated = ship(7, { state: 'sold', name: 'Updated', system: null })
    fleet.putFleetShip(updated)
    expect(fleet.getFleetShip(7)).toEqual(updated)
    expect(fleet.listFleetShips()).toHaveLength(3)
    const retrieved = fleet.getFleetShip(7)!
    retrieved.name = 'Changed outside repository'
    expect(fleet.getFleetShip(7)?.name).toBe('Updated')
    expect(() => fleet.putFleetShip({ ...updated, id: -1 })).toThrow()
    expect(fleet.listFleetShips()).toHaveLength(3)
  })
})

test('Fleet projection timestamp writes preserve key isolation and existing overwrite semantics', () => {
  withDatabase((_database, fleet) => {
    fleet.putFleetProjectionTimestamp('snapshot', '2026-08-17T12:00:00Z')
    fleet.putFleetProjectionTimestamp('mutation', '2026-08-18T12:00:00Z')
    fleet.putFleetProjectionTimestamp('snapshot', '2026-08-16T12:00:00Z')
    // Stale-event policy belongs to the service, not this repository.
    expect(fleet.getFleetProjectionTimestamp('snapshot')).toBe('2026-08-16T12:00:00Z')
    expect(fleet.getFleetProjectionTimestamp('mutation')).toBe('2026-08-18T12:00:00Z')
  })
})

test('stored module snapshots replace completely, order by slot and permit an empty snapshot', () => {
  withDatabase((_database, fleet) => {
    const initial = [module(12), module(3)]
    fleet.replaceStoredModules(initial)
    expect(fleet.listStoredModules()).toEqual([initial[1], initial[0]])
    const next = module(4, { engineering: null, displayName: null })
    fleet.replaceStoredModules([next])
    expect(fleet.listStoredModules()).toEqual([next])
    fleet.replaceStoredModules([])
    expect(fleet.listStoredModules()).toEqual([])
  })
})

test.each(['schema', 'duplicate slot'])('module replacement rolls back %s failures after a valid insert and releases its transaction', failure => {
  withDatabase((database, fleet) => {
    const original = module(9)
    fleet.replaceStoredModules([original])
    const first = module(2)
    const invalid = failure === 'schema' ? { ...module(3), buyPrice: -1 } : module(2)
    expect(() => fleet.replaceStoredModules([first, invalid])).toThrow()
    expect(fleet.listStoredModules()).toEqual([original])
    expect(database.health()).toMatchObject({ connected: true })
    fleet.putFleetShip(ship())
    fleet.replaceStoredModules([module(5)])
    expect(fleet.listStoredModules().map(item => item.storageSlot)).toEqual([5])
  })
})

test('Fleet data survives repeat initialization and reopen without resetting journal checkpoints', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-fleet-repository-'))
  const path = join(directory, 'test.sqlite')
  let database = new SqliteDatabase(path)
  try {
    expect(database.initialize()).toBe(true)
    database.fleet.putFleetShip(ship())
    database.fleet.replaceStoredModules([module()])
    database.fleet.putFleetProjectionTimestamp('snapshot', '2026-08-17T12:00:00Z')
    const checkpoint = { filePath: 'synthetic.log', byteOffset: 64, fileSize: 64, updatedAt: '2026-08-17T12:00:00Z' }
    database.putJournalCheckpoint(checkpoint)
    expect(database.initialize()).toBe(false)
    expect(database.getJournalCheckpoint(checkpoint.filePath)).toEqual(checkpoint)
    database.close()
    database = new SqliteDatabase(path)
    expect(database.initialize()).toBe(false)
    expect(database.fleet.listFleetShips()).toEqual([ship()])
    expect(database.fleet.listStoredModules()).toEqual([module()])
    expect(database.fleet.getFleetProjectionTimestamp('snapshot')).toBe('2026-08-17T12:00:00Z')
    expect(database.getJournalCheckpoint(checkpoint.filePath)).toEqual(checkpoint)
    const raw = new DatabaseSync(path)
    try {
      raw.prepare('UPDATE fleet_ships SET document = ? WHERE ship_id = ?').run('{}', 7)
      expect(() => database.fleet.getFleetShip(7)).toThrow()
      expect(() => database.fleet.listFleetShips()).toThrow()
      raw.prepare('UPDATE fleet_stored_modules SET document = ? WHERE storage_slot = ?').run('{', 9)
      expect(() => database.fleet.listStoredModules()).toThrow()
    } finally { raw.close() }
  } finally { database.close(); rmSync(directory, { recursive: true, force: true }) }
})

test('parent database close invalidates every Fleet operation and remains repeatable', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  const fleet = database.fleet
  database.close()
  database.close()
  for (const operation of [() => fleet.getFleetShip(7), () => fleet.listFleetShips(), () => fleet.putFleetShip(ship()),
    () => fleet.listStoredModules(), () => fleet.replaceStoredModules([]),
    () => fleet.getFleetProjectionTimestamp('snapshot'), () => fleet.putFleetProjectionTimestamp('snapshot', 'time')]) {
    expect(operation).toThrow()
  }
})

test('application Fleet HTTP uses journal projections on the database-owned repository', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-fleet-journal-'))
  const settings = new InMemorySystemSettingsRepository()
  settings.save({ ...settings.loadOrCreate(), community: { eddnEnabled: false, eddnChangedAt: 0 } })
  writeFileSync(join(directory, 'Journal.2026-08-16T120000.01.log'), [
    JSON.stringify({ timestamp: '2026-08-16T12:00:00Z', event: 'Loadout', ShipID: 7, Ship: 'sidewinder', ShipName: 'Fixture' }),
    JSON.stringify({ timestamp: '2026-08-16T12:01:00Z', event: 'StoredModules', Items: [{
      StorageSlot: 9, Name: '$int_engine_size5_class5_name;', MarketID: 1, StarSystem: 'Test System'
    }] }), ''
  ].join('\n'))
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: directory,
    host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null, openAiEnvironmentKey: null,
    systemSettingsRepository: settings })
  try {
    const address = await application.start()
    const response = await new PhoenixApiClient(`http://${address.host}:${address.port}`).getFleet()
    expect(response).toMatchObject({ activeShipId: 7, ships: [expect.objectContaining({ id: 7, name: 'Fixture' })],
      storedModules: { details: 'complete', items: [expect.objectContaining({ storageSlot: 9, system: 'Test System' })] } })
  } finally { await application.stop(); rmSync(directory, { recursive: true, force: true }) }
})

test('Fleet repository participates in transactions on its supplied connection without owning it', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-fleet-shared-'))
  const path = join(directory, 'shared.sqlite')
  const database = new SqliteDatabase(path)
  try {
    database.initialize()
    const connection = new DatabaseSync(path)
    try {
      const fleet = new SqliteFleetRepository(connection)
      connection.exec('BEGIN IMMEDIATE')
      fleet.putFleetShip(ship())
      fleet.putFleetProjectionTimestamp('snapshot', '2026-08-17T12:00:00Z')
      connection.prepare('INSERT INTO provider_response_cache VALUES (?, ?, ?, ?)').run('fixture', 'key', 'time', '{}')
      connection.exec('ROLLBACK')
      expect(fleet.listFleetShips()).toEqual([])
      expect(fleet.getFleetProjectionTimestamp('snapshot')).toBeNull()
      expect(database.getProviderResponse('fixture', 'key')).toBeNull()
      fleet.putFleetShip(ship())
      expect(database.fleet.getFleetShip(7)).toEqual(ship())
    } finally { connection.close() }
  } finally { database.close(); rmSync(directory, { recursive: true, force: true }) }
})
