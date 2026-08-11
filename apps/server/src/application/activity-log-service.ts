import { createHash, randomUUID } from 'node:crypto'
import {
  ActivityLogEntrySchema,
  type ActivityLogEntry,
  type ActivityLogResponse,
  type GameActionResult,
  type GameEventEnvelope
} from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import type { ActivityLogReader, ActivityLogRepository } from '../domain/elite-journal.js'

export class ActivityLogService implements ActivityLogReader {
  private readonly entries: ActivityLogEntry[] = []
  private readonly listeners = new Set<(entry: ActivityLogEntry) => void>()

  public constructor (
    private readonly repository: ActivityLogRepository,
    private readonly capacity = 1_000
  ) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('Activity log capacity must be positive.')
  }

  public ingestJournal (event: EliteJournalEvent): ActivityLogEntry {
    const importance = journalImportance(event.event)
    return this.record({
      timestamp: event.timestamp,
      event: event.event,
      source: 'journal',
      importance,
      actionable: actionableJournalEvents.has(event.event),
      data: structuredClone(event)
    }, importance !== 'trace')
  }

  public ingestRuntime (event: GameEventEnvelope): ActivityLogEntry {
    const importance = runtimeImportance(event.type)
    return this.record({
      timestamp: event.gameTimestamp ?? event.ingestedAt,
      event: event.type,
      source: 'runtime',
      importance,
      actionable: actionableRuntimeEvents.has(event.type),
      data: structuredClone(event) as unknown as Record<string, unknown>
    }, importance !== 'trace', stableRuntimeId(event))
  }

  public ingestAction (result: GameActionResult): ActivityLogEntry {
    return this.record({
      timestamp: result.timestamp,
      event: 'action.executed',
      source: 'action',
      importance: ['failed', 'rejected', 'timed_out'].includes(result.status) ? 'warning' : 'notable',
      actionable: ['failed', 'rejected', 'timed_out', 'unconfirmed'].includes(result.status),
      data: structuredClone(result) as unknown as Record<string, unknown>
    }, true, `action:${result.requestId}`)
  }

  public getRecent (limit = 250): ActivityLogResponse {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), this.capacity)
    const durable = this.repository.getRecentActivity(boundedLimit)
    const merged = new Map<string, ActivityLogEntry>()
    for (const entry of [...this.entries, ...durable]) merged.set(entry.id, entry)
    const entries = [...merged.values()]
      .sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp))
      .slice(0, boundedLimit)
    return { entries: structuredClone(entries), retained: merged.size }
  }

  public subscribe (listener: (entry: ActivityLogEntry) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private record (
    candidate: Omit<ActivityLogEntry, 'id' | 'ingestedAt'>,
    durable: boolean,
    id: string = randomUUID()
  ): ActivityLogEntry {
    const entry = ActivityLogEntrySchema.parse({
      ...candidate,
      id,
      ingestedAt: new Date().toISOString()
    })
    this.entries.unshift(entry)
    if (this.entries.length > this.capacity) this.entries.length = this.capacity
    if (durable) this.repository.putActivity(entry)
    for (const listener of this.listeners) listener(structuredClone(entry))
    return structuredClone(entry)
  }
}

function stableRuntimeId (event: GameEventEnvelope): string {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ type: event.type, gameTimestamp: event.gameTimestamp, payload: event.payload }))
    .digest('hex')
  return `runtime:${fingerprint}`
}

const actionableJournalEvents = new Set([
  'Bounty', 'CommitCrime', 'Died', 'Docked', 'FSDJump', 'Interdicted', 'MarketBuy',
  'MarketSell', 'MissionAccepted', 'MissionCompleted', 'MissionFailed', 'Scan',
  'ShipTargeted', 'UnderAttack'
])

const actionableRuntimeEvents = new Set([
  'location.changed', 'system.changed', 'ship.loadout_changed'
])

function journalImportance (event: string): ActivityLogEntry['importance'] {
  if (['Died', 'UnderAttack'].includes(event)) return 'critical'
  if (['CommitCrime', 'Interdicted', 'MissionFailed'].includes(event)) return 'warning'
  if (actionableJournalEvents.has(event)) return 'notable'
  return 'trace'
}

function runtimeImportance (event: string): ActivityLogEntry['importance'] {
  if (actionableRuntimeEvents.has(event)) return 'notable'
  if (['commander.identity_changed', 'commander.ranks_changed', 'commander.rank_progress_changed', 'inventory.cargo_changed'].includes(event)) return 'info'
  return 'trace'
}
