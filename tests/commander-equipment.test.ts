import { expect, test } from 'vitest'
import { DefaultCommanderEquipmentCatalogue } from '../apps/server/src/application/commander-equipment-catalogue.js'
import { CommanderEquipmentService } from '../apps/server/src/application/commander-equipment-service.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

test('commander equipment projection reconstructs current loadouts without regressing newer snapshots', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const equipment = new CommanderEquipmentService(
      database.commanderEquipment,
      new DefaultCommanderEquipmentCatalogue()
    )

    equipment.ingest({
      timestamp: '2026-08-15T10:00:00Z',
      event: 'SuitLoadout',
      LoadoutID: 7,
      LoadoutName: 'EXPEDITION',
      SuitID: 10,
      SuitName: 'explorationsuit_class2',
      SuitMods: ['suit_nightvision'],
      Modules: [{
        SlotName: 'PrimaryWeapon1',
        SuitModuleID: 20,
        ModuleName: 'wpn_m_sniper_plasma_charged',
        Class: 2,
        WeaponMods: ['weapon_scope']
      }]
    })
    equipment.ingest({
      timestamp: '2026-08-14T08:00:00Z', event: 'BuySuit', SuitID: 10,
      Name: 'explorationsuit_class1', Class: 1, Price: 150_000
    })
    equipment.ingest({
      timestamp: '2026-08-14T08:01:00Z', event: 'BuyWeapon', SuitModuleID: 20,
      Name: 'wpn_m_sniper_plasma_charged', Class: 1, Price: 125_000
    })
    equipment.ingest({
      timestamp: '2026-08-14T09:00:00Z', event: 'UpgradeWeapon', SuitModuleID: 20,
      Name: 'wpn_m_sniper_plasma_charged', Class: 2, Cost: 100_000,
      Resources: [
        { Name: 'weaponcomponent', Name_Localised: 'Weapon Component', Count: 2 },
        { Name: 'weaponcomponent', Name_Localised: 'Weapon Component', Count: 1 }
      ]
    })
    equipment.ingest({
      timestamp: '2026-08-14T07:00:00Z', event: 'BuySuit', SuitID: 99,
      Name: 'utilitysuit_class1', Class: 1, Price: 100_000
    })
    equipment.ingest({
      timestamp: '2026-08-14T07:30:00Z', event: 'SellSuit', SuitID: 99,
      Name: 'utilitysuit_class1'
    })

    expect(equipment.getEquipment()).toMatchObject({
      schemaVersion: 1,
      ownershipCoverage: 'observed',
      currentLoadoutId: 7,
      summary: { loadouts: 1, suits: 1, weapons: 1 },
      loadouts: [{ id: 7, name: 'EXPEDITION', suitId: 10, slots: [{ slot: 'PrimaryWeapon1', weaponId: 20 }] }],
      suits: [{
        id: 10,
        displayName: 'Artemis Suit',
        grade: 2,
        purchasePrice: 150_000,
        modifications: [{ symbol: 'suit_nightvision', displayName: 'Night Vision' }],
        loadoutIds: [7]
      }],
      weapons: [{
        id: 20,
        displayName: 'Manticore Executioner',
        grade: 2,
        purchasePrice: 125_000,
        modifications: [{ symbol: 'weapon_scope', displayName: 'Scope' }],
        lastUpgrade: {
          grade: 2,
          credits: 100_000,
          resources: [{ symbol: 'weaponcomponent', displayName: 'Weapon Component', count: 3 }]
        },
        loadoutIds: [7]
      }]
    })
  } finally {
    database.close()
  }
})

test('commander equipment projection applies loadout mutations and deletion chronologically', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const equipment = new CommanderEquipmentService(
      database.commanderEquipment,
      new DefaultCommanderEquipmentCatalogue()
    )
    equipment.ingest({
      timestamp: '2026-08-15T08:00:00Z', event: 'CreateSuitLoadout',
      LoadoutID: 3, LoadoutName: 'NEW LOADOUT', SuitID: 4,
      SuitName: 'tacticalsuit_class1', Modules: []
    })
    equipment.ingest({
      timestamp: '2026-08-15T08:01:00Z', event: 'RenameSuitLoadout',
      LoadoutID: 3, LoadoutName: 'COMBAT'
    })
    equipment.ingest({
      timestamp: '2026-08-15T08:02:00Z', event: 'LoadoutEquipModule',
      LoadoutID: 3, LoadoutName: 'COMBAT', SuitID: 4,
      SuitModuleID: 5, SlotName: 'PrimaryWeapon1', ModuleName: 'wpn_m_assaultrifle_kinetic_fauto'
    })
    equipment.ingest({
      timestamp: '2026-08-15T08:03:00Z', event: 'LoadoutRemoveModule',
      LoadoutID: 3, SlotName: 'PrimaryWeapon1', SuitModuleID: 5,
      ModuleName: 'wpn_m_assaultrifle_kinetic_fauto'
    })
    equipment.ingest({
      timestamp: '2026-08-15T08:04:00Z', event: 'DeleteSuitLoadout',
      LoadoutID: 3, LoadoutName: 'COMBAT', SuitID: 4
    })

    expect(equipment.getEquipment()).toMatchObject({
      currentLoadoutId: null,
      loadouts: [],
      summary: { loadouts: 0, suits: 1, weapons: 1 }
    })
  } finally {
    database.close()
  }
})

test('commander equipment API exposes a versioned observed-ownership document', async () => {
  const application = new PhoenixApplication({
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    port: 0
  })
  const address = await application.start()
  try {
    const equipment = await new PhoenixApiClient(`http://${address.host}:${address.port}`).getCommanderEquipment()
    expect(equipment).toEqual({
      schemaVersion: 1,
      ownershipCoverage: 'observed',
      currentLoadoutId: null,
      updatedAt: null,
      loadouts: [],
      suits: [],
      weapons: [],
      summary: { loadouts: 0, suits: 0, weapons: 0 }
    })
  } finally {
    await application.stop()
  }
})
