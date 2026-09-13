import type { CommanderLogEntry, CommanderLogResponse } from '@phoenix/contracts'

export interface CommanderLogRepository {
  countCommanderLogEntries(): number
  getRecentCommanderLogEntries(limit: number): CommanderLogEntry[]
  putCommanderLogEntry(entry: CommanderLogEntry): void
}

export interface CommanderLogReader {
  getRecent(limit?: number): CommanderLogResponse
  subscribe(listener: (entry: CommanderLogEntry) => void): () => void
}
