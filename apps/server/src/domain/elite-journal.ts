import type { ActivityLogEntry, ActivityLogResponse, EliteJournalSourceDiagnostics } from '@phoenix/contracts'

export interface EliteJournalDiagnosticsReader {
  getDiagnostics(): EliteJournalSourceDiagnostics
}

export interface ActivityLogReader {
  getRecent(limit?: number): ActivityLogResponse
  subscribe(listener: (entry: ActivityLogEntry) => void): () => void
}

export interface ActivityLogRepository {
  getRecentActivity(limit: number): ActivityLogEntry[]
  putActivity(entry: ActivityLogEntry): void
}
