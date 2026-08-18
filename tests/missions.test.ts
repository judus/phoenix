import { expect, test } from 'vitest'
import type { Mission } from '@phoenix/contracts'
import { MissionDataService } from '../apps/server/src/application/mission-data-service.js'
import type { MissionRepository } from '../apps/server/src/domain/missions.js'
import { SqliteDatabase } from '../apps/server/src/infrastructure/sqlite-database.js'

test('mission journal projection retains acceptance, delivery progress, redirect and completion', () => {
  const repository = new MemoryMissionRepository()
  const missions = new MissionDataService(repository)

  missions.ingest({
    timestamp: '2026-08-14T10:00:00Z', event: 'MissionAccepted', MissionID: 42,
    LocalisedName: 'Deliver medicines', Name: 'Mission_Delivery_name', Faction: 'Rescue Wing',
    DestinationSystem: 'Sol', DestinationStation: 'Galileo', Commodity: '$BasicMedicines_Name;',
    Count: 20, Reward: 125000, Wing: true
  }, 'historical-journal')
  missions.ingest({
    timestamp: '2026-08-14T10:15:00Z', event: 'CargoDepot', MissionID: 42,
    CargoType: '$BasicMedicines_Name;', ItemsCollected: 20, ItemsDelivered: 8, TotalItemsToDeliver: 20
  }, 'live-journal')
  missions.ingest({
    timestamp: '2026-08-14T10:20:00Z', event: 'MissionRedirected', MissionID: 42,
    NewDestinationSystem: 'Alpha Centauri', NewDestinationStation: 'Hutton Orbital'
  }, 'live-journal')
  missions.ingest({
    timestamp: '2026-08-14T11:00:00Z', event: 'MissionCompleted', MissionID: 42, Reward: 150000
  }, 'live-journal')

  expect(missions.getMissions()).toMatchObject({
    summary: { active: 0, completed: 1, partial: 0, total: 1 },
    missions: [{
      id: 42, status: 'completed', localizedName: 'Deliver medicines', faction: 'Rescue Wing',
      destinationSystem: 'Alpha Centauri', destinationStation: 'Hutton Orbital', reward: 150000,
      completedAt: '2026-08-14T11:00:00Z',
      progress: { collected: 20, delivered: 8, required: 20 },
      provenance: {
        acceptanceObserved: true, details: 'complete', terminalObserved: true,
        sources: ['historical-journal', 'live-journal']
      }
    }]
  })
})

test('startup mission snapshot creates honest partial records and does not let older history regress status', () => {
  const repository = new MemoryMissionRepository()
  const missions = new MissionDataService(repository)

  missions.ingest({
    timestamp: '2026-08-15T08:00:00Z', event: 'Missions',
    Active: [{ MissionID: 7, Name: 'Mission_Courier_name', Expires: 3600 }], Failed: [], Complete: []
  }, 'live-journal')
  missions.ingest({
    timestamp: '2026-08-14T08:00:00Z', event: 'MissionCompleted', MissionID: 7, Name: 'Mission_Courier_name'
  }, 'historical-journal')

  expect(missions.getMissions().missions[0]).toMatchObject({
    id: 7,
    status: 'active',
    statusUpdatedAt: '2026-08-15T08:00:00Z',
    provenance: { acceptanceObserved: false, details: 'partial', snapshotObserved: true }
  })
  expect(missions.getMissions().snapshotAt).toBe('2026-08-15T08:00:00Z')
})

test('a newer startup snapshot reconciles active missions discovered later by historical backfill', () => {
  const repository = new MemoryMissionRepository()
  const missions = new MissionDataService(repository)
  missions.ingest({ timestamp: '2026-08-15T08:00:00Z', event: 'Missions', Active: [], Failed: [], Complete: [] }, 'live-journal')
  missions.ingest({ timestamp: '2026-08-14T08:00:00Z', event: 'MissionAccepted', MissionID: 8, LocalisedName: 'Old unresolved contract' }, 'historical-journal')
  expect(missions.getMissions().missions[0]).toMatchObject({
    id: 8,
    status: 'unknown',
    provenance: { acceptanceObserved: true, details: 'complete', snapshotObserved: true }
  })
})

test('SQLite persists normalized missions', () => {
  const database = new SqliteDatabase(':memory:')
  database.initialize()
  try {
    const service = new MissionDataService(database)
    service.ingest({ timestamp: '2026-08-15T08:00:00Z', event: 'MissionAccepted', MissionID: 99, LocalisedName: 'Test contract' }, 'live-journal')
    service.ingest({ timestamp: '2026-08-15T08:01:00Z', event: 'Missions', Active: [{ MissionID: 99 }], Failed: [], Complete: [] }, 'live-journal')
    expect(database.getMission(99)).toMatchObject({ id: 99, localizedName: 'Test contract', status: 'active' })
    expect(database.listMissions()).toHaveLength(1)
    expect(new MissionDataService(database).getMissions().snapshotAt).toBe('2026-08-15T08:01:00Z')
  } finally {
    database.close()
  }
})

class MemoryMissionRepository implements MissionRepository {
  private readonly records = new Map<number, Mission>()
  private readonly state = new Map<string, string>()
  public getMission (id: number): Mission | null { return this.records.get(id) ?? null }
  public getMissionProjectionTimestamp (key: string): string | null { return this.state.get(key) ?? null }
  public listMissions (): Mission[] { return [...this.records.values()] }
  public putMission (mission: Mission): void { this.records.set(mission.id, structuredClone(mission)) }
  public putMissionProjectionTimestamp (key: string, timestamp: string): void { this.state.set(key, timestamp) }
}
