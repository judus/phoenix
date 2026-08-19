import type {
  ControlGridLayout,
  PhoenixSettings,
  RuntimeSystemSnapshot
} from '@phoenix/contracts'
import type { ControlDeckConfigurationRepository } from '@jdu/control-deck-core'

export interface SystemSettingsRepository {
  loadOrCreate(): PhoenixSettings
  save(settings: PhoenixSettings): void
}

export interface OpenAiSecretRepository {
  get(): string | undefined
  save(apiKey: string): void
  remove(): void
}

export interface ControlGridLayoutRepository extends ControlDeckConfigurationRepository {
  getLayout(): ControlGridLayout
  saveLayout(layout: ControlGridLayout): ControlGridLayout
}

export interface RuntimeSystemSnapshotWriter {
  write(snapshot: RuntimeSystemSnapshot): void
}
