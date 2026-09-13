import {
  CommanderLogResponseSchema,
  type CommanderLogEntry,
  type CommanderLogResponse
} from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import type { CommanderLogReader, CommanderLogRepository } from '../../domain/commander-log.js'
import type { CommanderLogProjector } from './commander-log-projector.js'

export type CommanderLogProjectionMode = 'live' | 'historical'

export class CommanderLogService implements CommanderLogReader {
  private readonly listeners = new Set<(entry: CommanderLogEntry) => void>()

  public constructor (
    private readonly repository: CommanderLogRepository,
    private readonly projector: CommanderLogProjector
  ) {}

  public ingest (
    event: EliteJournalEvent,
    mode: CommanderLogProjectionMode = 'live'
  ): CommanderLogEntry | null {
    const entry = this.projector.project(event)
    if (!entry) return null
    this.repository.putCommanderLogEntry(entry)
    if (mode === 'live') {
      for (const listener of this.listeners) listener(structuredClone(entry))
    }
    return structuredClone(entry)
  }

  public getRecent (limit = 24): CommanderLogResponse {
    const boundedLimit = Math.min(Math.max(Math.trunc(limit), 1), 250)
    const entries = this.repository.getRecentCommanderLogEntries(boundedLimit)
    return CommanderLogResponseSchema.parse({
      schemaVersion: 1,
      entries,
      retained: this.repository.countCommanderLogEntries()
    })
  }

  public subscribe (listener: (entry: CommanderLogEntry) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }
}
