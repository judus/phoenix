import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { expect, test, vi } from 'vitest'
import type { CommanderLogEntry } from '@phoenix/contracts'
import { CommanderLogService } from '../apps/server/src/application/commander-log/commander-log-service.js'
import { DefaultCommanderLogProjector } from '../apps/server/src/application/commander-log/commander-log-projector.js'
import type { CommanderLogRepository } from '../apps/server/src/domain/commander-log.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

const noMissions = { getMission: () => null }
const projector = new DefaultCommanderLogProjector(
  noMissions,
  identifier => identifier === 'adder' ? 'Adder' : null,
  identifier => identifier === 'Engine_Dirty' ? 'Dirty Engine' : null
)

test('new milestones use explicit journal evidence, not scan steps or estimated earnings', () => {
  const p = new DefaultCommanderLogProjector(noMissions, () => null, () => null)
  const timestamp = '2026-09-27T22:00:00Z'
  p.project({ timestamp, event: 'Docked', StarSystem: 'Wolf 363', StationName: 'Pirsan Station', MarketID: 42 })
  const trade = { timestamp, event: 'MaterialTrade', MarketID: 42,
    Paid: { Material_Localised: 'Shielding Sensors', Quantity: 36 },
    Received: { Material_Localised: 'Conductive Polymers', Quantity: 1 } }
  expect(p.project(trade)).toMatchObject({
    kind: 'engineering.materials_traded', creditDelta: null,
    detail: '36 × Shielding Sensors → 1 × Conductive Polymers · Pirsan Station · Wolf 363'
  })
  expect(p.project({ ...trade, Paid: {} })).toBeNull()
  expect(p.project({ ...trade, MarketID: 99 })?.detail).not.toContain('Pirsan')
  expect(p.project({ timestamp, event: 'SearchAndRescue', MarketID: 42, Name_Localised: 'Occupied Escape Pod', Count: 3, Reward: 90147 }))
    .toMatchObject({ kind: 'finance.salvage_delivered', creditDelta: 90147, detail: '3 × Occupied Escape Pod · Pirsan Station · Wolf 363' })
  p.project({ timestamp, event: 'SAAScanComplete', SystemAddress: 123, BodyID: 7, BodyName: 'Test A 7' })
  const scan = { timestamp, event: 'ScanOrganic', ScanType: 'Analyse', Species_Localised: 'Fonticulua Fluctus', SystemAddress: 123, Body: 7 }
  expect(p.project(scan)).toMatchObject({ kind: 'exploration.biological_analysis_completed', detail: 'Fonticulua Fluctus · Test A 7', creditDelta: null })
  expect(p.project({ ...scan, ScanType: 'Sample' })).toBeNull()
  expect(p.project({ ...scan, ScanType: 'Log' })).toBeNull()
})

test('engineering groups consecutive rolls by ship, module slot, blueprint and engineer without deleting raw events', () => {
  const repository = new MemoryCommanderLogRepository()
  const p = new DefaultCommanderLogProjector(noMissions, () => null, () => 'Overcharged')
  const service = new CommanderLogService(repository, p)
  service.ingest({ timestamp: '2026-09-27T10:00:00Z', event: 'LoadGame', ShipID: 21 }, 'historical')
  const roll = { timestamp: '2026-09-27T10:01:00Z', event: 'EngineerCraft', Slot: 'MediumHardpoint1', Module: 'multicannon', BlueprintName: 'Weapon_Overcharged', Engineer: 'Tod', Level: 1 }
  service.ingest(roll, 'historical')
  service.ingest(roll, 'historical')
  service.ingest({ ...roll, timestamp: '2026-09-27T10:01:10Z', Level: 2 }, 'historical')
  expect(service.getRecent()).toMatchObject({ retained: 2, entries: [
    expect.objectContaining({ title: 'Engineering applied', detail: 'Overcharged · MediumHardpoint1 · Grade 1 → 2 · 2 rolls · Tod' })
  ] })
  service.ingest({ ...roll, timestamp: '2026-09-27T10:01:20Z', Slot: 'MediumHardpoint2' })
  expect(service.getRecent().entries).toHaveLength(2)
  service.ingest({ ...roll, timestamp: '2026-09-27T10:10:00Z', Slot: 'MediumHardpoint2' })
  expect(service.getRecent().entries).toHaveLength(3)
  service.ingest({ timestamp: '2026-09-27T10:10:01Z', event: 'Loadout', ShipID: 22 })
  service.ingest({ ...roll, timestamp: '2026-09-27T10:10:02Z', Slot: 'MediumHardpoint2' })
  expect(service.getRecent().entries).toHaveLength(4)
  const restarted = new CommanderLogService(repository, new DefaultCommanderLogProjector(noMissions, () => null, () => null))
  expect(restarted.getRecent()).toEqual(service.getRecent())
})

test('Commander Log projects mission lifecycle and explicit credit evidence', () => {
  expect(projector.project({
    event: 'MissionCompleted',
    timestamp: '2026-09-13T10:00:00Z',
    MissionID: 42,
    LocalisedName: 'Deliver medicines',
    DestinationSystem: 'Sol',
    DestinationStation: 'Galileo',
    Reward: 125000
  })).toMatchObject({
    schemaVersion: 1,
    category: 'mission',
    kind: 'mission.completed',
    title: 'Mission completed',
    detail: 'Deliver medicines · Galileo, Sol',
    creditDelta: 125000,
    tone: 'positive',
    sourceEvent: 'MissionCompleted'
  })

  expect(projector.project({
    event: 'MissionCompleted',
    timestamp: '2026-09-13T10:01:00Z',
    MissionID: 43,
    LocalisedName: 'Donation contract'
  })).toMatchObject({ creditDelta: null })
})

test('Commander Log projects selected trade and finance events without inventing amounts', () => {
  expect(projector.project({
    event: 'MarketSell',
    timestamp: '2026-09-13T11:00:00Z',
    Type: 'advancedcatalysers',
    Type_Localised: 'Advanced Catalysers',
    Count: 32,
    TotalSale: 186000
  })).toMatchObject({
    category: 'trade',
    kind: 'trade.commodity_sold',
    detail: '32 units · Advanced Catalysers',
    creditDelta: 186000
  })
  expect(projector.project({
    event: 'RedeemVoucher',
    timestamp: '2026-09-13T11:01:00Z',
    Type: 'bounty',
    Amount: 4200000
  })).toMatchObject({ kind: 'finance.voucher_redeemed', creditDelta: 4200000 })
  expect(projector.project({
    event: 'SellExplorationData',
    timestamp: '2026-09-13T11:02:00Z',
    BaseValue: 1000,
    Bonus: 500
  })).toBeNull()
  expect(projector.project({
    event: 'Docked',
    timestamp: '2026-09-13T11:03:00Z',
    StationName: 'Galileo'
  })).toBeNull()
})

test('Commander Log distinguishes deliberate career updates from startup snapshots', () => {
  expect(projector.project({
    event: 'Promotion',
    timestamp: '2026-09-13T12:00:00Z',
    Explore: 6
  })).toMatchObject({
    category: 'career',
    kind: 'career.promoted',
    title: 'Exploration rank advanced',
    detail: 'Ranger'
  })
  expect(projector.project({
    event: 'EngineerProgress',
    timestamp: '2026-09-13T12:01:00Z',
    Engineers: [{ Engineer: 'Elvira Martuuk', EngineerID: 300160, Rank: 5 }]
  })).toBeNull()
  expect(projector.project({
    event: 'ShipyardBuy',
    timestamp: '2026-09-13T12:02:00Z',
    ShipType: 'adder',
    ShipPrice: 87808
  })).toMatchObject({
    category: 'fleet',
    kind: 'fleet.ship_bought',
    detail: 'Adder',
    creditDelta: -87808
  })

  expect(projector.project({
    event: 'EngineerCraft',
    timestamp: '2026-09-13T12:03:00Z',
    BlueprintName: 'Engine_Dirty',
    Level: 2,
    Engineer: 'Elvira Martuuk'
  })).toMatchObject({
    kind: 'engineering.blueprint_applied',
    detail: 'Dirty Engine · Grade 2 · Elvira Martuuk'
  })

  expect(projector.project({
    event: 'EngineerCraft',
    timestamp: '2026-09-13T12:04:00Z',
    BlueprintName: 'FSD_LongRange',
    ApplyExperimentalEffect: 'special_fsd_heavy',
    ExperimentalEffect: 'special_fsd_heavy',
    ExperimentalEffect_Localised: 'Mass Manager',
    Level: 5,
    Engineer: 'Felicity Farseer'
  })).toMatchObject({
    title: 'Experimental effect applied',
    detail: 'Mass Manager · Grade 5 · Felicity Farseer'
  })
})

test('Commander Log persistence is idempotent and historical replay stays quiet', () => {
  const repository = new MemoryCommanderLogRepository()
  const service = new CommanderLogService(repository, projector)
  const listener = vi.fn()
  service.subscribe(listener)
  const event = {
    event: 'MarketBuy',
    timestamp: '2026-09-13T13:00:00Z',
    Type: 'gold',
    Count: 4,
    TotalCost: 200000
  }

  service.ingest(event, 'historical')
  service.ingest(event, 'historical')

  expect(service.getRecent()).toMatchObject({ schemaVersion: 1, retained: 1 })
  expect(listener).not.toHaveBeenCalled()
  service.ingest({ ...event, timestamp: '2026-09-13T13:01:00Z' })
  expect(listener).toHaveBeenCalledOnce()
})

test.each([22, 24])('Commander Log projection migration %i replays previously checkpointed journals', version => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-commander-log-migration-'))
  const path = join(directory, 'phoenix.sqlite')
  const initial = new SqliteDatabase(path)
  initial.initialize()
  initial.putJournalCheckpoint({
    byteOffset: 4096,
    filePath: '/journals/Journal.test.log',
    fileSize: 8192,
    updatedAt: '2026-09-13T12:00:00.000Z'
  })
  initial.commanderLog.putCommanderLogEntry({
    category: 'mission',
    creditDelta: null,
    detail: null,
    id: 'stale-entry',
    kind: 'mission.accepted',
    schemaVersion: 1,
    sourceEvent: 'MissionAccepted',
    timestamp: '2026-09-13T12:00:00.000Z',
    title: 'Mission accepted',
    tone: 'neutral'
  })
  initial.close()

  const raw = new DatabaseSync(path)
  raw.prepare('DELETE FROM schema_migrations WHERE version = ?').run(version)
  raw.close()

  const migrated = new SqliteDatabase(path)
  try {
    migrated.initialize()
    expect(migrated.getJournalCheckpoint('/journals/Journal.test.log')).toBeNull()
    expect(migrated.commanderLog.countCommanderLogEntries()).toBe(version === 24 ? 1 : 0)
  } finally {
    migrated.close()
  }

  const verified = new DatabaseSync(path)
  try {
    expect(verified.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(version))
      .toEqual({ version })
  } finally {
    verified.close()
    rmSync(directory, { force: true, recursive: true })
  }
})

test('Commander Log is populated through the journal pipeline and canonical API', async () => {
  const eliteDirectory = mkdtempSync(join(tmpdir(), 'phoenix-commander-log-'))
  writeFileSync(join(eliteDirectory, 'Journal.2026-09-13T140000.01.log'), [
    '{"timestamp":"2026-09-13T14:00:00Z","event":"MissionAccepted","MissionID":42,"LocalisedName":"Deliver medicines","DestinationSystem":"Sol","DestinationStation":"Galileo","Reward":90000}',
    '{"timestamp":"2026-09-13T14:30:00Z","event":"MissionCompleted","MissionID":42,"Reward":125000}',
    ''
  ].join('\n'))
  const application = new PhoenixApplication({
    copilot: null,
    copilotRealtime: null,
    databasePath: ':memory:',
    eliteDirectory,
    host: '127.0.0.1',
    port: 0
  })

  try {
    const address = await application.start()
    const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)
    const response = await client.getCommanderLog()
    expect(response).toMatchObject({ schemaVersion: 1, retained: 2 })
    expect(response.entries.map(entry => entry.kind)).toEqual([
      'mission.completed',
      'mission.accepted'
    ])
    expect(response.entries[0]).toMatchObject({
      detail: 'Deliver medicines · Galileo, Sol',
      creditDelta: 125000
    })
  } finally {
    await application.stop()
    rmSync(eliteDirectory, { recursive: true, force: true })
  }
})

class MemoryCommanderLogRepository implements CommanderLogRepository {
  private readonly entries = new Map<string, CommanderLogEntry>()

  public countCommanderLogEntries (): number { return this.entries.size }

  public getRecentCommanderLogEntries (limit: number): CommanderLogEntry[] {
    return [...this.entries.values()]
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(0, limit)
  }

  public putCommanderLogEntry (entry: CommanderLogEntry): void {
    this.entries.set(entry.id, structuredClone(entry))
  }
}
