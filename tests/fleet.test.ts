import type { ModuleDefinition } from '@phoenix/contracts'
import { expect, test } from 'vitest'
import { FleetDataService } from '../apps/server/src/application/fleet-data-service.js'
import type { FleetCatalogueResolver } from '../apps/server/src/domain/fleet.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'

test('fleet projection combines the active loadout with authoritative stored ships', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const fleet = new FleetDataService(
      database,
      catalogue({ resolveShipDisplayName: identifier => identifier === 'lakonminer' ? 'Type-11 Prospector' : null }),
      { resolve: (systemName, marketId) => systemName === 'Atata' && marketId === 200 ? 'Shajn Market' : null }
    )
    fleet.ingest({
      timestamp: '2026-08-15T08:00:00Z', event: 'Loadout', Ship: 'lakonminer', ShipID: 13,
      ShipIdent: 'EL-06L', HullValue: 60_000_000, ModulesValue: 40_000_000
    })
    fleet.ingest({
      timestamp: '2026-08-15T08:01:00Z', event: 'StoredShips', StationName: 'Locke Terminal',
      MarketID: 100, StarSystem: 'Test System', ShipsHere: [], ShipsRemote: [{
        ShipID: 3, ShipType: 'SideWinder', Name: '', StarSystem: 'Atata', ShipMarketID: 200,
        TransferPrice: 1395, TransferTime: 2425, Value: 27450, Hot: false
      }]
    })
    fleet.ingest({ timestamp: '2026-08-15T08:02:00Z', event: 'Location', StarSystem: 'Test System', StationName: 'Locke Terminal', MarketID: 100 })

    expect(fleet.getFleet()).toMatchObject({
      activeShipId: 13,
      shipsSnapshotAt: '2026-08-15T08:01:00Z',
      summary: { active: 1, owned: 2, stored: 1, transferring: 0, unknown: 0 },
      ships: [
        { id: 13, displayName: 'Type-11 Prospector', identifier: 'EL-06L', state: 'active', system: 'Test System', station: 'Locke Terminal', typeId: 'lakonminer', value: 100_000_000 },
        {
          id: 3,
          marketId: 200,
          state: 'stored-remote',
          station: 'Shajn Market',
          system: 'Atata',
          transferPrice: 1395,
          transferSeconds: 2425,
          typeId: 'SideWinder'
        }
      ]
    })
  } finally {
    database.close()
  }
})

test('newer fleet snapshots are not regressed by historical backfill', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const fleet = new FleetDataService(database, catalogue())
    fleet.ingest({
      timestamp: '2026-08-15T08:00:00Z', event: 'StoredShips', StationName: 'New', MarketID: 100,
      StarSystem: 'New System', ShipsHere: [{ ShipID: 3, ShipType: 'SideWinder', Value: 30000, Hot: false }], ShipsRemote: []
    })
    fleet.ingest({
      timestamp: '2026-08-14T08:00:00Z', event: 'StoredShips', StationName: 'Old', MarketID: 99,
      StarSystem: 'Old System', ShipsHere: [{ ShipID: 3, ShipType: 'SideWinder', Value: 20000, Hot: false }], ShipsRemote: []
    })
    expect(fleet.getFleet().ships[0]).toMatchObject({ marketId: 100, station: 'New', system: 'New System', value: 30000 })
  } finally {
    database.close()
  }
})

test('stored module snapshot reports later mutations as partial without guessing an item identity', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const fleet = new FleetDataService(
      database,
      catalogue({
        resolveBlueprintDisplayName: symbol => symbol === 'Weapon_Efficient' ? 'Efficient Weapon' : null,
        resolveModule: identifier => moduleDefinition(identifier, {
          displayName: 'Beam Laser',
          category: 'hardpoint',
          size: 3,
          rating: 'C',
          mount: 'Gimballed'
        })
      }),
      { resolve: (systemName, marketId) => systemName === 'Atata' && marketId === 200 ? 'Shajn Market' : null }
    )
    fleet.ingest({
      timestamp: '2026-08-15T08:00:00Z', event: 'StoredModules', Items: [{
        Name: '$hpt_beamlaser_gimbal_large_name;', Name_Localised: 'Beam Laser', StorageSlot: 81,
        StarSystem: 'Atata', MarketID: 200, TransferCost: 100, TransferTime: 20,
        BuyPrice: 2_000_000, Hot: false, EngineerModifications: 'Weapon_Efficient', Level: 2, Quality: 1
      }]
    })
    fleet.ingest({ timestamp: '2026-08-15T08:05:00Z', event: 'ModuleRetrieve', RetrievedItem: '$hpt_beamlaser_gimbal_large_name;' })

    expect(fleet.getFleet().storedModules).toMatchObject({
      details: 'partial',
      snapshotAt: '2026-08-15T08:00:00Z',
      latestMutationAt: '2026-08-15T08:05:00Z',
      items: [{
        storageSlot: 81,
        displayName: 'Beam Laser',
        definition: { displayName: 'Beam Laser', size: 3, rating: 'C', mount: 'Gimballed' },
        station: 'Shajn Market',
        engineering: { blueprint: 'Weapon_Efficient', displayName: 'Efficient Weapon', level: 2 }
      }]
    })
  } finally {
    database.close()
  }
})

function catalogue(overrides: Partial<FleetCatalogueResolver> = {}): FleetCatalogueResolver {
  return {
    resolveBlueprintDisplayName: () => null,
    resolveModule: identifier => moduleDefinition(identifier),
    resolveShipDisplayName: () => null,
    ...overrides
  }
}

function moduleDefinition(identifier: string, overrides: Partial<ModuleDefinition> = {}): ModuleDefinition {
  return {
    journalId: identifier,
    displayName: 'Unknown module',
    category: null,
    size: null,
    rating: null,
    mount: null,
    guidance: null,
    ship: null,
    source: { kind: 'inferred', name: 'Test resolver', repository: null, revision: null },
    ...overrides
  }
}
