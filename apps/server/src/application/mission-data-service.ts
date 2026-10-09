import {
  MissionRecordSchema,
  MissionsResponseSchema,
  type Mission,
  type MissionRecord,
  type CommanderInventory,
  type MissionStatus,
  type MissionsResponse
} from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import type { MissionDataReader, MissionLookup, MissionRepository } from '../domain/missions.js'
import { missionBriefing } from './mission-briefing.js'

export type MissionJournalSource = 'historical-journal' | 'live-journal'

export class MissionDataService implements MissionDataReader, MissionLookup {
  private latestSnapshot: { active: Set<number>, timestamp: string } | null = null

  public constructor (
    private readonly repository: MissionRepository,
    private readonly inventory: () => CommanderInventory = () => ({
      cargo: null, materials: null, backpack: null, shipLocker: null
    })
  ) {}

  public ingest (event: EliteJournalEvent, source: MissionJournalSource): void {
    switch (event.event) {
      case 'MissionAccepted': this.ingestAccepted(event, source); break
      case 'MissionCompleted': this.ingestTerminal(event, source, 'completed'); break
      case 'MissionFailed': this.ingestTerminal(event, source, 'failed'); break
      case 'MissionAbandoned': this.ingestTerminal(event, source, 'abandoned'); break
      case 'MissionRedirected': this.ingestRedirected(event, source); break
      case 'CargoDepot': this.ingestCargoDepot(event, source); break
      case 'Missions': this.ingestSnapshot(event, source); break
    }
  }

  public getMissions (): MissionsResponse {
    const inventory = this.inventory()
    const missions = this.repository.listMissions().sort(compareMissions).map(record => missionBriefing(record, inventory))
    const count = (status: MissionStatus) => missions.filter(mission => mission.status === status).length
    return MissionsResponseSchema.parse({
      missions,
      snapshotAt: this.repository.getMissionProjectionTimestamp('missions-snapshot'),
      summary: {
        abandoned: count('abandoned'),
        active: count('active'),
        completed: count('completed'),
        failed: count('failed'),
        partial: missions.filter(mission => mission.provenance.details === 'partial').length,
        total: missions.length,
        unknown: count('unknown')
      }
    })
  }

  public getMission (id: number): Mission | null {
    const record = this.repository.getMission(id)
    return record ? missionBriefing(record, this.inventory()) : null
  }

  private ingestAccepted (event: EliteJournalEvent, source: MissionJournalSource): void {
    const id = integer(event.MissionID)
    if (id === null) return
    const current = this.repository.getMission(id) ?? emptyMission(id, event.timestamp)
    const next = mergeStatus(current, 'active', event.timestamp)
    let mission = MissionRecordSchema.parse({
      ...next,
      acceptedAt: current.acceptedAt ?? event.timestamp,
      commodity: text(event.Commodity_Localised) ?? text(event.Commodity) ?? current.commodity,
      commodityId: text(event.Commodity) ?? current.commodityId,
      commodityCount: integer(event.Count) ?? current.commodityCount,
      destinationSettlement: text(event.DestinationSettlement) ?? current.destinationSettlement,
      destinationStation: text(event.DestinationStation) ?? current.destinationStation,
      destinationSystem: text(event.DestinationSystem) ?? current.destinationSystem,
      donation: integer(event.Donation) ?? current.donation,
      expiry: text(event.Expiry) ?? current.expiry,
      faction: text(event.Faction) ?? current.faction,
      influence: text(event.Influence) ?? current.influence,
      killCount: integer(event.KillCount) ?? current.killCount,
      localizedName: text(event.LocalisedName) ?? current.localizedName,
      name: text(event.Name) ?? current.name,
      passengerCount: integer(event.PassengerCount) ?? current.passengerCount,
      provenance: provenance(current, source, { acceptanceObserved: true }),
      reputation: text(event.Reputation) ?? current.reputation,
      reward: integer(event.Reward) ?? current.reward,
      target: text(event.Target) ?? current.target,
      targetFaction: text(event.TargetFaction) ?? current.targetFaction,
      targetType: text(event.TargetType_Localised) ?? text(event.TargetType) ?? current.targetType,
      targetTypeId: text(event.TargetType) ?? current.targetTypeId,
      updatedAt: latest(current.updatedAt, event.timestamp),
      wing: boolean(event.Wing) ?? current.wing
    })
    if (source === 'historical-journal' && this.latestSnapshot && event.timestamp < this.latestSnapshot.timestamp && !this.latestSnapshot.active.has(id)) {
      mission = MissionRecordSchema.parse({
        ...mergeStatus(mission, 'unknown', this.latestSnapshot.timestamp),
        provenance: provenance(mission, 'startup-snapshot', { snapshotObserved: true }),
        updatedAt: latest(mission.updatedAt, this.latestSnapshot.timestamp)
      })
    }
    this.repository.putMission(mission)
  }

  private ingestTerminal (event: EliteJournalEvent, source: MissionJournalSource, status: Extract<MissionStatus, 'completed' | 'failed' | 'abandoned'>): void {
    const id = integer(event.MissionID)
    if (id === null) return
    const current = this.repository.getMission(id) ?? emptyMission(id, event.timestamp)
    const next = mergeStatus(current, status, event.timestamp)
    this.repository.putMission(MissionRecordSchema.parse({
      ...next,
      [`${status === 'completed' ? 'completed' : status}At`]: event.timestamp,
      commodity: text(event.Commodity_Localised) ?? current.commodity ?? text(event.Commodity),
      commodityId: text(event.Commodity) ?? current.commodityId,
      commodityCount: integer(event.Count) ?? current.commodityCount,
      destinationStation: text(event.DestinationStation) ?? current.destinationStation,
      destinationSettlement: text(event.DestinationSettlement) ?? current.destinationSettlement,
      destinationSystem: text(event.DestinationSystem) ?? current.destinationSystem,
      donated: integer(event.Donated) ?? current.donated,
      donation: integer(event.Donation) ?? current.donation,
      faction: text(event.Faction) ?? current.faction,
      localizedName: text(event.LocalisedName) ?? current.localizedName,
      name: text(event.Name) ?? current.name,
      provenance: provenance(current, source, { terminalObserved: true }),
      receivedRewards: status === 'completed'
        ? { credits: integer(event.Reward), materials: materialRewards(event.MaterialsReward) }
        : current.receivedRewards,
      killCount: integer(event.KillCount) ?? current.killCount,
      target: text(event.Target) ?? current.target,
      targetFaction: text(event.TargetFaction) ?? current.targetFaction,
      targetType: text(event.TargetType_Localised) ?? text(event.TargetType) ?? current.targetType,
      targetTypeId: text(event.TargetType) ?? current.targetTypeId,
      updatedAt: latest(current.updatedAt, event.timestamp)
    }))
  }

  private ingestRedirected (event: EliteJournalEvent, source: MissionJournalSource): void {
    const id = integer(event.MissionID)
    if (id === null) return
    const current = this.repository.getMission(id) ?? emptyMission(id, event.timestamp)
    this.repository.putMission(MissionRecordSchema.parse({
      ...current,
      destinationStation: text(event.NewDestinationStation) ?? current.destinationStation,
      destinationSystem: text(event.NewDestinationSystem) ?? current.destinationSystem,
      name: text(event.Name) ?? current.name,
      provenance: provenance(current, source),
      redirectedAt: event.timestamp,
      updatedAt: latest(current.updatedAt, event.timestamp)
    }))
  }

  private ingestCargoDepot (event: EliteJournalEvent, source: MissionJournalSource): void {
    const id = integer(event.MissionID)
    if (id === null) return
    const current = this.repository.getMission(id) ?? emptyMission(id, event.timestamp)
    this.repository.putMission(MissionRecordSchema.parse({
      ...current,
      commodity: current.commodity ?? text(event.CargoType),
      commodityId: text(event.CargoType) ?? current.commodityId,
      progress: {
        collected: integer(event.ItemsCollected) ?? current.progress.collected,
        delivered: integer(event.ItemsDelivered) ?? current.progress.delivered,
        required: integer(event.TotalItemsToDeliver) ?? current.progress.required
      },
      provenance: provenance(current, source),
      updatedAt: latest(current.updatedAt, event.timestamp)
    }))
  }

  private ingestSnapshot (event: EliteJournalEvent, source: MissionJournalSource): void {
    const entries: Array<[unknown, MissionStatus]> = [
      [event.Active, 'active'], [event.Complete, 'completed'], [event.Failed, 'failed']
    ]
    const observed = new Set<number>()
    for (const [candidate, status] of entries) {
      if (!Array.isArray(candidate)) continue
      for (const item of candidate) {
        if (!record(item)) continue
        const id = integer(item.MissionID)
        if (id === null) continue
        observed.add(id)
        const current = this.repository.getMission(id) ?? emptyMission(id, event.timestamp)
        const next = mergeStatus(current, status, event.timestamp)
        const terminalTime = status === 'completed'
          ? { completedAt: current.completedAt ?? event.timestamp }
          : status === 'failed'
            ? { failedAt: current.failedAt ?? event.timestamp }
            : {}
        this.repository.putMission(MissionRecordSchema.parse({
          ...next,
          ...terminalTime,
          expiry: expiry(item.Expires, event.timestamp) ?? current.expiry,
          name: text(item.Name) ?? current.name,
          provenance: provenance(current, 'startup-snapshot', {
            snapshotObserved: true,
            terminalObserved: status === 'active' ? current.provenance.terminalObserved : true
          }),
          updatedAt: latest(current.updatedAt, event.timestamp),
          wing: boolean(item.Wing) ?? current.wing
        }))
      }
    }
    if (!this.latestSnapshot || event.timestamp >= this.latestSnapshot.timestamp) {
      this.latestSnapshot = { active: new Set(
        Array.isArray(event.Active)
          ? event.Active.flatMap(item => record(item) && integer(item.MissionID) !== null ? [integer(item.MissionID)!] : [])
          : []
      ), timestamp: event.timestamp }
      this.repository.putMissionProjectionTimestamp('missions-snapshot', event.timestamp)
    }
    for (const current of this.repository.listMissions()) {
      if (current.status !== 'active' || observed.has(current.id) || event.timestamp < current.statusUpdatedAt) continue
      this.repository.putMission(MissionRecordSchema.parse({
        ...mergeStatus(current, 'unknown', event.timestamp),
        provenance: provenance(current, 'startup-snapshot', { snapshotObserved: true }),
        updatedAt: latest(current.updatedAt, event.timestamp)
      }))
    }
    void source
  }
}

function emptyMission (id: number, timestamp: string): MissionRecord {
  return MissionRecordSchema.parse({
    acceptedAt: null, abandonedAt: null, commodity: null, commodityCount: null,
    commodityId: null, targetTypeId: null, receivedRewards: null,
    completedAt: null, destinationSettlement: null, destinationStation: null,
    destinationSystem: null, donated: null, donation: null, expiry: null, faction: null, failedAt: null, id,
    influence: null, killCount: null, localizedName: null, name: null, passengerCount: null,
    progress: { collected: null, delivered: null, required: null },
    provenance: { acceptanceObserved: false, details: 'partial', snapshotObserved: false, sources: [], terminalObserved: false },
    redirectedAt: null, reputation: null, reward: null, status: 'unknown',
    statusUpdatedAt: timestamp, target: null, targetFaction: null, targetType: null,
    updatedAt: timestamp, wing: null
  })
}

function mergeStatus (mission: MissionRecord, status: MissionStatus, timestamp: string): MissionRecord {
  if (timestamp < mission.statusUpdatedAt) return mission
  if (timestamp === mission.statusUpdatedAt && statusRank(status) < statusRank(mission.status)) return mission
  return { ...mission, status, statusUpdatedAt: timestamp }
}

function provenance (mission: MissionRecord, source: MissionRecord['provenance']['sources'][number], changes: Partial<MissionRecord['provenance']> = {}): MissionRecord['provenance'] {
  const acceptanceObserved = changes.acceptanceObserved ?? mission.provenance.acceptanceObserved
  return {
    ...mission.provenance,
    ...changes,
    acceptanceObserved,
    details: acceptanceObserved ? 'complete' : 'partial',
    sources: [...new Set([...mission.provenance.sources, source])]
  }
}

function statusRank (status: MissionStatus): number {
  return { unknown: 0, active: 1, abandoned: 2, failed: 3, completed: 4 }[status]
}

function compareMissions (left: MissionRecord, right: MissionRecord): number {
  const active = Number(right.status === 'active') - Number(left.status === 'active')
  return active || right.updatedAt.localeCompare(left.updatedAt) || right.id - left.id
}

function latest (left: string, right: string): string { return left > right ? left : right }
function materialRewards (value: unknown): NonNullable<MissionRecord['receivedRewards']>['materials'] {
  if (!Array.isArray(value)) return null
  const rewards: NonNullable<NonNullable<MissionRecord['receivedRewards']>['materials']> = []
  for (const item of value) {
    if (!record(item)) return null
    const id = text(item.Name)
    const count = integer(item.Count)
    if (id === null || count === null) return null
    rewards.push({ id, count, label: text(item.Name_Localised), category: text(item.Category) })
  }
  return rewards
}
function record (value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function text (value: unknown): string | null { return typeof value === 'string' && value.trim() ? value : null }
function integer (value: unknown): number | null {
  const parsed = typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : value
  return Number.isSafeInteger(parsed) && Number(parsed) >= 0 ? Number(parsed) : null
}
function boolean (value: unknown): boolean | null { return typeof value === 'boolean' ? value : null }
function expiry (value: unknown, timestamp: string): string | null {
  const seconds = integer(value)
  if (seconds !== null) return seconds > 0 ? new Date(Date.parse(timestamp) + seconds * 1000).toISOString() : null
  return text(value)
}
