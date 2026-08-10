import type { EliteStatusSourceDiagnostics } from '@phoenix/contracts'

export interface EliteStatusDiagnosticsReader {
  getDiagnostics(): EliteStatusSourceDiagnostics
}
