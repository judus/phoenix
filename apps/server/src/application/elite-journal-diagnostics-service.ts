import type { EliteJournalSourceDiagnostics } from '@phoenix/contracts'
import type {
  EliteJournalFileSource,
  EliteJournalHistoryBackfill
} from '@phoenix/elite'
import type { EliteJournalDiagnosticsReader } from '../domain/elite-journal.js'

export class EliteJournalDiagnosticsService implements EliteJournalDiagnosticsReader {
  public constructor (
    private readonly liveSource: EliteJournalFileSource,
    private readonly historyBackfill: EliteJournalHistoryBackfill
  ) {}

  public getDiagnostics (): EliteJournalSourceDiagnostics {
    return {
      ...this.liveSource.getDiagnostics(),
      backfill: this.historyBackfill.getDiagnostics()
    }
  }
}
