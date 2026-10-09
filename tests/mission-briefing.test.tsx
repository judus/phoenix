import { renderToStaticMarkup } from 'react-dom/server'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test } from 'vitest'
import type { CommanderInventory } from '@phoenix/contracts'
import { classifyMission, parseMicroResourceInventory } from '@phoenix/elite'
import { MissionDataService } from '../apps/server/src/application/mission-data-service.js'
import { MissionRuntimeContext } from '../apps/server/src/application/mission-runtime-context.js'
import { MissionsListMissionsTool } from '../apps/server/src/application/mcp-tools/missions-list-missions-tool.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { ActivitiesPage } from '../apps/web/src/features/activities/activities-page.js'

test.each([
  ['Mission_OnFoot_Delivery_Legal_MB_name', 'Delivery', ['Legal contract']],
  ['$Mission_OnFoot_Heist_Covert_NCD_MB_name;', 'Heist', ['Covert', 'Nonviolent']],
  ['Mission_OnFoot_Download_Illegal_MB_name', 'Data download', ['Illegal contract']],
  ['Mission_OnFoot_Upload_MB_name', 'Data upload', []],
  ['Mission_OnFoot_RebootRestore_MB_name', 'Settlement restoration', []],
  ['Mission_OnFoot_Sabotage_Power_MB_name', 'Sabotage', []],
  ['Mission_OnFoot_Onslaught_MB_name', 'Settlement combat', []],
  ['Mission_OnFoot_FutureThing_MB_name', null, []],
  ['Mission_OnFoot_Heist_Legal_Illegal_MB_name', 'Heist', []]
])('classifies only explicit invariant tokens: %s', (name, activity, conditions) => {
  expect(classifyMission(name)).toEqual({ onFoot: true, activity, conditions })
})

test('translated titles and unrelated mission names cannot create on-foot restrictions', () => {
  expect(classifyMission('Mission_Delivery_name')).toEqual({ onFoot: false, activity: null, conditions: [] })
  expect(classifyMission(null)).toEqual({ onFoot: false, activity: null, conditions: [] })
})

test('mission brief shares contract, mission-tagged inventory and actual rewards across UI and Copilot', async () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  let inventory: CommanderInventory = { backpack: null, shipLocker: null, cargo: null, materials: null }
  const service = new MissionDataService(database, () => inventory)
  try {
    service.ingest({
      event: 'MissionAccepted', timestamp: '2026-10-10T12:00:00Z', MissionID: 42,
      Name: 'Mission_OnFoot_Heist_Covert_NCD_MB_name', LocalisedName: 'Retrieve documents',
      Commodity: 'personalDocuments', Commodity_Localised: 'Personal documents', Count: 1,
      DestinationSystem: 'Sol', DestinationSettlement: 'Research base',
      Target: 'Contact Ada', TargetType: '$MissionContact;', TargetType_Localised: 'Contact',
      TargetFaction: 'Research faction', Reward: 100000
    }, 'live-journal')
    inventory = {
      ...inventory,
      backpack: parseMicroResourceInventory({
        event: 'Backpack', timestamp: '2026-10-10T12:05:00Z',
        Items: [
          { Name: 'personalDocuments', Name_Localised: 'Personal documents', Count: 1, MissionID: 42 },
          { Name: 'personalDocuments', Count: 5, MissionID: 43 },
          { Name: 'healthpack', Count: 3 }
        ], Components: [], Consumables: [], Data: []
      })
    }
    const brief = service.getMission(42)!
    expect(brief).toMatchObject({
      commodityId: 'personalDocuments', commodity: 'Personal documents',
      targetTypeId: '$MissionContact;', targetType: 'Contact',
      status: 'active', receivedRewards: null, reward: 100000,
      briefing: {
        activity: 'Heist', conditions: ['Covert', 'Nonviolent'],
        inventory: { backpackAt: '2026-10-10T12:05:00Z', shipLockerAt: null }
      }
    })
    expect(brief.briefing.inventory.items).toEqual([{
      id: 'personalDocuments', label: 'Personal documents', count: 1, store: 'backpack',
      observedAt: '2026-10-10T12:05:00Z'
    }])
    const context = new MissionRuntimeContext(service).render()
    expect(context).toContain('known contract conditions: Covert, Nonviolent')
    expect(context).toContain('possession is not objective completion')
    const tool = await new MissionsListMissionsTool(service).execute({})
    expect(JSON.stringify(tool)).toContain('Personal documents')
    expect(JSON.stringify(tool)).toContain('commodityId')

    inventory = {
      ...inventory,
      backpack: parseMicroResourceInventory({
        event: 'Backpack', timestamp: '2026-10-10T12:06:00Z', Items: []
      }),
      shipLocker: parseMicroResourceInventory({
        event: 'ShipLocker', timestamp: '2026-10-10T12:07:00Z',
        Items: [{ Name: 'personalDocuments', Count: 1, MissionID: 42 }]
      })
    }
    expect(service.getMission(42)!.briefing.inventory.items).toEqual([{
      id: 'personalDocuments', label: null, count: 1, store: 'shipLocker',
      observedAt: '2026-10-10T12:07:00Z'
    }])
    expect(service.getMission(42)!.status).toBe('active')
    service.ingest({
      event: 'MissionCompleted', timestamp: '2026-10-10T12:10:00Z', MissionID: 42,
      DestinationSettlement: 'Hand-in base', Reward: 120000,
      MaterialsReward: [{ Name: 'SuitSchematic', Name_Localised: 'Suit schematic',
        Category: '$MICRORESOURCE_CATEGORY_Item;', Count: 2 }]
    }, 'live-journal')
    const completed = new MissionDataService(database, () => inventory).getMission(42)!
    expect(completed).toMatchObject({
      destinationSettlement: 'Hand-in base', reward: 100000,
      receivedRewards: {
        credits: 120000,
        materials: [{ id: 'SuitSchematic', label: 'Suit schematic', count: 2, category: '$MICRORESOURCE_CATEGORY_Item;' }]
      }
    })
    const markup = renderToStaticMarkup(<ActivitiesPage view="missions" controller={{ status: 'ready', missions: service.getMissions() }} />)
    expect(markup).toContain('Required item')
    expect(markup).toContain('Target type')
    expect(markup).toContain('Received materials')
    expect(markup).toContain('Suit schematic × 2')
    expect(markup).not.toContain('Delivery progress')
    expect(markup).not.toContain('label="Cargo"')
  } finally {
    database.close()
  }
})

test('retained mission documents migrate once and replay recovers identifiers and distinct rewards', () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-mission-migration-'))
  const path = join(directory, 'test.sqlite')
  let database = new SqliteDatabase(path)
  try {
    database.initialize()
    const service = new MissionDataService(database)
    const accepted = {
      event: 'MissionAccepted', timestamp: '2026-10-10T12:00:00Z', MissionID: 9,
      Name: 'Mission_OnFoot_Delivery_MB_name', Commodity: 'personalDocuments', Count: 1, Reward: 100
    }
    const completed = {
      event: 'MissionCompleted', timestamp: '2026-10-10T12:05:00Z', MissionID: 9, Reward: 120
    }
    service.ingest(accepted, 'live-journal')
    service.ingest(completed, 'live-journal')
    database.putJournalCheckpoint({ filePath: '/synthetic/journal', byteOffset: 50, fileSize: 50, updatedAt: completed.timestamp })
    database.close()
    const legacy = new DatabaseSync(path)
    try {
      legacy.exec(`
        DELETE FROM schema_migrations WHERE version = 30;
        UPDATE missions SET document = json_remove(json_set(document, '$.reward', 120),
          '$.commodityId', '$.targetTypeId', '$.receivedRewards');
      `)
    } finally { legacy.close() }
    database = new SqliteDatabase(path)
    database.initialize()
    expect(database.getMission(9)).toMatchObject({
      status: 'completed', commodityId: null, targetTypeId: null, reward: null, receivedRewards: null
    })
    expect(database.getJournalCheckpoint('/synthetic/journal')).toBeNull()
    const replay = new MissionDataService(database)
    replay.ingest(accepted, 'historical-journal')
    replay.ingest(completed, 'historical-journal')
    expect(replay.getMission(9)).toMatchObject({
      status: 'completed', commodityId: 'personalDocuments', reward: 100, receivedRewards: { credits: 120 }
    })
    database.initialize()
    expect(database.getMission(9)!.receivedRewards).toMatchObject({ credits: 120 })
  } finally {
    database.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('required kills are not observed progress and a startup completion does not invent reward claims', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  const service = new MissionDataService(database)
  try {
    service.ingest({
      event: 'MissionAccepted', timestamp: '2026-10-10T12:00:00Z', MissionID: 4,
      Name: 'Mission_OnFoot_Onslaught_MB_name', KillCount: 8
    }, 'live-journal')
    service.ingest({
      event: 'Missions', timestamp: '2026-10-10T12:05:00Z',
      Active: [], Failed: [], Complete: [{ MissionID: 4 }]
    }, 'live-journal')
    expect(service.getMission(4)).toMatchObject({ killCount: 8, receivedRewards: null })
    const markup = renderToStaticMarkup(<ActivitiesPage view="missions" controller={{ status: 'ready', missions: service.getMissions() }} />)
    expect(markup).toContain('Required kills')
    expect(markup).not.toContain('Delivery progress')
    expect(markup).not.toContain('Received credits')
  } finally {
    database.close()
  }
})
