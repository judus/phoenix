import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { CatalogueDiagnosticsSchema, EliteJournalSourceDiagnosticsSchema } from '@phoenix/contracts'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

const fixturePath = fileURLToPath(
  new URL('./fixtures/elite/Journal.2026-08-10T120000.01.log', import.meta.url)
)

test('application startup projects the current commander, ranks, location and ship from the journal', async () => {
  const eliteDirectory = mkdtempSync(join(tmpdir(), 'phoenix-journal-integration-'))
  copyFileSync(fixturePath, join(eliteDirectory, basename(fixturePath)))
  const application = new PhoenixApplication({
    databasePath: ':memory:',
    eliteDirectory,
    host: '127.0.0.1',
    port: 0
  })

  try {
    const address = await application.start()
    const baseUrl = `http://${address.host}:${address.port}`
    const client = new PhoenixApiClient(baseUrl)
    const state = await client.getRuntimeState()
    const catalogueDiagnostics = await getCatalogueDiagnostics(baseUrl)
    const shipCatalogue = await client.getShipCatalogue()
    const diagnostics = await getEliteJournalDiagnostics(baseUrl)
    const journal = await client.getActivityLog()

    expect(state).toMatchObject({
      revision: 13,
      commander: {
        name: 'Test Commander',
        ranks: { combat: 5, trade: 8, exploration: 6, exobiologist: 4 },
        rankProgress: { combat: 42, exploration: 73, exobiologist: 91 }
      },
      system: {
        name: 'Sol',
        address: 10477373803,
        position: [0, 0, 0],
        allegiance: 'Federation',
        primaryEconomy: { id: '$economy_HighTech;', label: 'High Tech' },
        secondaryEconomy: { id: '$economy_Industrial;', label: 'Industrial' },
        security: { label: 'High Security' },
        population: 22000000000,
        controllingFaction: { name: 'Mother Gaia', state: 'Boom' },
        factions: [{ name: 'Mother Gaia', influence: 0.6 }]
      },
      location: {
        state: 'docked',
        place: {
          kind: 'station',
          name: 'Galileo',
          type: 'Orbis',
          marketId: 128666762,
          faction: { name: 'Mother Gaia', state: 'Boom' },
          primaryEconomy: { label: 'High Tech' },
          economies: [
            { economy: { label: 'High Tech' }, proportion: 0.8 },
            { economy: { label: 'Industrial' }, proportion: 0.2 }
          ],
          services: ['dock', 'commodities', 'outfitting', 'shipyard']
        }
      },
      ship: {
        id: 7,
        typeId: 'cobramkiii',
        definition: {
          id: 'cobra_mk_iii',
          displayName: 'Cobra Mk III',
          source: { kind: 'catalogue', name: 'EDCD Coriolis Data' }
        },
        name: 'Wayward Sun',
        identifier: 'PHX-01',
        hullHealth: 1,
        unladenMass: 245.5,
        cargoCapacity: 32,
        maxJumpRange: 22.4,
        fuelCapacity: { main: 16, reserve: 0.5 },
        modules: [
          {
            slotId: 'PowerPlant',
            slotGroup: 'core',
            slotSize: 4,
            expectedSlot: { name: 'Power Plant', size: 4 },
            moduleId: 'int_powerplant_size4_class5',
            moduleSize: 4,
            moduleClass: 5,
            definition: {
              displayName: 'Power Plant',
              rating: 'A',
              source: { kind: 'catalogue', name: 'EDCD FDevIDs' }
            }
          },
          {
            slotId: 'MediumHardpoint1',
            slotGroup: 'hardpoint',
            slotSize: 2,
            expectedSlot: { size: 2 },
            definition: { displayName: 'Beam Laser' },
            engineering: {
              engineer: 'The Dweller',
              blueprintName: 'Weapon_Efficient',
              level: 3,
              experimentalEffectLabel: 'Thermal Conduit',
              modifiers: [{ label: 'DamagePerSecond', lessIsGood: false }]
            }
          },
          {
            slotId: 'TinyHardpoint1',
            slotGroup: 'utility',
            expectedSlot: { size: 0 },
            definition: { displayName: 'Shield Booster' }
          },
          {
            slotId: 'Slot01_Size4',
            slotGroup: 'optional',
            slotSize: 4,
            expectedSlot: { size: 4 },
            definition: { displayName: 'Cargo Rack' }
          }
        ]
      },
      inventory: {
        cargo: {
          updatedAt: '2026-08-10T12:00:06Z',
          vessel: 'ship',
          items: [
            { id: 'gold', label: 'Gold', count: 3, stolen: 0, missionId: null },
            { id: 'missioncommodity', count: 2, missionId: 42 }
          ]
        },
        materials: {
          updatedAt: '2026-08-10T12:00:11Z',
          raw: [
            { id: 'iron', label: 'Iron', count: 12 },
            { id: 'selenium', label: 'Selenium', count: 1 }
          ],
          manufactured: [{ id: 'focuscrystals', count: 4 }],
          encoded: [{ id: 'disruptedwakeechoes', count: 8 }]
        },
        shipLocker: {
          components: [{ id: 'microelectrode', count: 6 }]
        },
        backpack: {
          consumables: [{ id: 'healthpack', label: 'Medkit', count: 2 }]
        }
      },
      gameStatus: null
    })
    expect(shipCatalogue.ships).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cobra_mk_iii', displayName: 'Cobra Mk III' }),
      expect.objectContaining({ id: 'type_11_prospector', displayName: 'Type-11 Prospector' })
    ]))
    expect(diagnostics).toMatchObject({
      directory: eliteDirectory,
      watching: true,
      fileAvailable: true,
      linesRead: 12,
      error: null
    })
    expect(journal.retained).toBe(25)
    expect(journal.entries).toHaveLength(25)
    expect(journal.entries).toContainEqual(expect.objectContaining({
      source: 'runtime',
      event: 'inventory.material_adjusted',
      actionable: false,
      data: expect.objectContaining({ type: 'inventory.material_adjusted' })
    }))
    expect(journal.entries).toContainEqual(expect.objectContaining({
      source: 'journal',
      event: 'MaterialTrade',
      data: expect.objectContaining({ event: 'MaterialTrade', timestamp: '2026-08-10T12:00:11Z' })
    }))
    expect(catalogueDiagnostics).toMatchObject({
      shipCount: 47,
      shipAliasCount: 90,
      moduleCount: 1190,
      currentShip: {
        typeId: 'cobramkiii',
        displayName: 'Cobra Mk III',
        shipResolved: true,
        moduleCount: 4,
        catalogueModules: 4,
        inferredModules: 0
      }
    })
  } finally {
    await application.stop()
    rmSync(eliteDirectory, { recursive: true, force: true })
  }
})

test('historical journal backfill runs after startup without replacing live runtime state', async () => {
  const eliteDirectory = mkdtempSync(join(tmpdir(), 'phoenix-journal-background-'))
  writeFileSync(
    join(eliteDirectory, 'Journal.2026-08-09T120000.01.log'),
    [
      '{"timestamp":"2026-08-09T12:00:00Z","event":"Location","StarSystem":"Old system","SystemAddress":1,"StarPos":[1,2,3]}',
      '{"timestamp":"2026-08-09T12:01:00Z","event":"FSSDiscoveryScan","SystemName":"Old system","SystemAddress":1,"BodyCount":3}',
      ''
    ].join('\n')
  )
  copyFileSync(fixturePath, join(eliteDirectory, basename(fixturePath)))
  const application = new PhoenixApplication({
    databasePath: ':memory:',
    eliteDirectory,
    host: '127.0.0.1',
    port: 0
  })

  try {
    const address = await application.start()
    const baseUrl = `http://${address.host}:${address.port}`
    const client = new PhoenixApiClient(baseUrl)
    expect((await client.getRuntimeState()).system.name).toBe('Sol')

    await waitFor(async () => (
      (await getEliteJournalDiagnostics(baseUrl)).backfill?.status === 'complete'
    ))
    expect(await getEliteJournalDiagnostics(baseUrl)).toMatchObject({
      backfill: {
        status: 'complete',
        filesDiscovered: 1,
        filesCompleted: 1,
        linesProcessed: 2
      }
    })
    expect((await client.getRuntimeState()).system.name).toBe('Sol')
  } finally {
    await application.stop()
    rmSync(eliteDirectory, { recursive: true, force: true })
  }
})

test('mission history and startup snapshot feed the durable Operations API', async () => {
  const eliteDirectory = mkdtempSync(join(tmpdir(), 'phoenix-mission-integration-'))
  writeFileSync(join(eliteDirectory, 'Journal.2026-08-14T120000.01.log'), [
    '{"timestamp":"2026-08-14T12:00:00Z","event":"MissionAccepted","MissionID":42,"LocalisedName":"Deliver medicines","Faction":"Rescue Wing","DestinationSystem":"Sol","DestinationStation":"Galileo","Commodity":"$BasicMedicines_Name;","Count":12,"Reward":90000}',
    ''
  ].join('\n'))
  writeFileSync(join(eliteDirectory, 'Journal.2026-08-15T120000.01.log'), [
    '{"timestamp":"2026-08-15T12:00:00Z","event":"Missions","Active":[{"MissionID":42,"Name":"Mission_Delivery_name"},{"MissionID":77,"Name":"Mission_Courier_name"}],"Failed":[],"Complete":[]}',
    ''
  ].join('\n'))
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory, host: '127.0.0.1', port: 0 })

  try {
    const address = await application.start()
    const baseUrl = `http://${address.host}:${address.port}`
    const client = new PhoenixApiClient(baseUrl)
    await waitFor(async () => (await getEliteJournalDiagnostics(baseUrl)).backfill?.status === 'complete')
    const response = await client.getMissions()
    expect(response.summary).toMatchObject({ active: 2, partial: 1, total: 2 })
    expect(response.missions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 42, localizedName: 'Deliver medicines', status: 'active', provenance: expect.objectContaining({ details: 'complete' }) }),
      expect.objectContaining({ id: 77, status: 'active', provenance: expect.objectContaining({ details: 'partial' }) })
    ]))
  } finally {
    await application.stop()
    rmSync(eliteDirectory, { recursive: true, force: true })
  }
})

async function getCatalogueDiagnostics (baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/developer/catalogue`)
  expect(response.ok).toBe(true)
  return CatalogueDiagnosticsSchema.parse(await response.json())
}

async function getEliteJournalDiagnostics (baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/developer/elite-journal`)
  expect(response.ok).toBe(true)
  return EliteJournalSourceDiagnosticsSchema.parse(await response.json())
}

async function waitFor (predicate: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 2_000
  while (Date.now() < deadline) {
    if (await predicate()) return
    await new Promise(resolvePromise => setTimeout(resolvePromise, 10))
  }
  throw new Error('Timed out waiting for journal backfill.')
}
