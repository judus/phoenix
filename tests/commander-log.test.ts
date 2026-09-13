import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, vi } from 'vitest'
import type { CommanderLogEntry } from '@phoenix/contracts'
import { CommanderLogService } from '../apps/server/src/application/commander-log/commander-log-service.js'
import { DefaultCommanderLogProjector } from '../apps/server/src/application/commander-log/commander-log-projector.js'
import type { CommanderLogRepository } from '../apps/server/src/domain/commander-log.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

const noMissions = { getMission: () => null }
const projector = new DefaultCommanderLogProjector(
  noMissions,
  identifier => identifier === 'adder' ? 'Adder' : null
)

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
