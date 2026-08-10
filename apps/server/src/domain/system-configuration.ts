import type { PhoenixSettings, RuntimeSystemSnapshot } from '@phoenix/contracts'

export interface SystemSettingsRepository {
  loadOrCreate(): PhoenixSettings
}

export interface RuntimeSystemSnapshotWriter {
  write(snapshot: RuntimeSystemSnapshot): void
}
