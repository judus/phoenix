import type { EliteJournalSourceDiagnostics } from '@phoenix/contracts'

export interface EliteJournalDiagnosticsReader {
  getDiagnostics(): EliteJournalSourceDiagnostics
}
