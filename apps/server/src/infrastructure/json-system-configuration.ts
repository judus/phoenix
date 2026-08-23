import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  ControlDeckConfigurationConflictError,
  type ControlDeckConfiguration,
  type ControlDeckConfigurationRepository
} from 'control-deck/core'
import {
  PhoenixControlDeckConfigurationSchema,
  PhoenixSettingsSchema,
  RuntimeSystemSnapshotSchema,
  type PhoenixSettings,
  type RuntimeSystemSnapshot
} from '@phoenix/contracts'
import type {
  RuntimeSystemSnapshotWriter,
  SystemSettingsRepository
} from '../domain/system-configuration.js'
import { BLANK_CONTROL_DECK_CONFIGURATION, DEFAULT_CONTROL_DECK_CONFIGURATION } from './default-control-deck-configuration.js'
import {
  ensurePrivateDirectorySync,
  PRIVATE_FILE_MODE,
  restrictPrivateFileSync
} from './private-user-state.js'

export const DEFAULT_PHOENIX_SETTINGS: PhoenixSettings = {
  version: 1,
  copilot: {
    activeProfileId: 'marin',
    permissions: { gameActions: false, macros: false, dangerousActions: false }
  },
  controls: {
    enabled: true,
    backend: 'auto',
    deckConfiguration: DEFAULT_CONTROL_DECK_CONFIGURATION
  },
  modules: {
    numpadCommands: {
      inputAdapter: 'browser',
      presentation: 'tiles',
      alwaysConfirm: false,
      cancelAfterMs: 5000
    }
  }
}

export class JsonSystemSettingsRepository implements SystemSettingsRepository, ControlDeckConfigurationRepository {
  public constructor (private readonly path: string) {}

  public loadOrCreate (): PhoenixSettings {
    ensurePrivateDirectorySync(dirname(this.path))
    if (!existsSync(this.path)) {
      const settings = PhoenixSettingsSchema.parse(DEFAULT_PHOENIX_SETTINGS)
      writeJsonAtomically(this.path, settings)
      return settings
    }

    restrictPrivateFileSync(this.path)

    const candidate: unknown = JSON.parse(readFileSync(this.path, 'utf8'))
    const normalized = withFreshControlDeckIfNeeded(candidate)
    const settings = PhoenixSettingsSchema.parse(normalized)
    if (normalized !== candidate) this.save(settings)
    return settings
  }

  public save (candidate: PhoenixSettings): void {
    writeJsonAtomically(this.path, PhoenixSettingsSchema.parse(candidate))
  }

  public getConfiguration (): ControlDeckConfiguration {
    return this.loadOrCreate().controls.deckConfiguration
  }

  public saveConfiguration (candidate: ControlDeckConfiguration): ControlDeckConfiguration {
    const configuration = PhoenixControlDeckConfigurationSchema.parse(candidate)
    const settings = this.loadOrCreate()
    const current = settings.controls.deckConfiguration
    if (configuration.revision !== current.revision) throw new ControlDeckConfigurationConflictError()
    const saved = PhoenixControlDeckConfigurationSchema.parse({ ...configuration, revision: current.revision + 1 })
    this.save({ ...settings, controls: { ...settings.controls, deckConfiguration: saved } })
    return saved
  }
}

export class InMemorySystemSettingsRepository implements SystemSettingsRepository {
  private settings = PhoenixSettingsSchema.parse(DEFAULT_PHOENIX_SETTINGS)

  public loadOrCreate (): PhoenixSettings { return PhoenixSettingsSchema.parse(this.settings) }
  public save (settings: PhoenixSettings): void { this.settings = PhoenixSettingsSchema.parse(settings) }
}

function withFreshControlDeckIfNeeded (candidate: unknown): unknown {
  if (!isRecord(candidate) || !isRecord(candidate.controls)) return candidate
  if (PhoenixControlDeckConfigurationSchema.safeParse(candidate.controls.deckConfiguration).success) return candidate
  return {
    ...candidate,
    controls: {
      ...candidate.controls,
      deckConfiguration: BLANK_CONTROL_DECK_CONFIGURATION
    }
  }
}

function isRecord (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export class JsonRuntimeSystemSnapshotWriter implements RuntimeSystemSnapshotWriter {
  public constructor (private readonly path: string) {}

  public write (candidate: RuntimeSystemSnapshot): void {
    writeJsonAtomically(this.path, RuntimeSystemSnapshotSchema.parse(candidate))
  }
}

function writeJsonAtomically (path: string, value: unknown): void {
  ensurePrivateDirectorySync(dirname(path))
  const temporaryPath = `${path}.tmp-${process.pid}`
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: PRIVATE_FILE_MODE })
  restrictPrivateFileSync(temporaryPath)
  renameSync(temporaryPath, path)
  restrictPrivateFileSync(path)
}
