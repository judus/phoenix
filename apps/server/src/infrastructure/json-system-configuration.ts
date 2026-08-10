import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  PhoenixSettingsSchema,
  RuntimeSystemSnapshotSchema,
  type PhoenixSettings,
  type RuntimeSystemSnapshot
} from '@phoenix/contracts'
import type {
  RuntimeSystemSnapshotWriter,
  SystemSettingsRepository
} from '../domain/system-configuration.js'

export const DEFAULT_PHOENIX_SETTINGS: PhoenixSettings = {
  version: 1,
  controls: {
    enabled: true,
    backend: 'auto'
  }
}

export class JsonSystemSettingsRepository implements SystemSettingsRepository {
  public constructor (private readonly path: string) {}

  public loadOrCreate (): PhoenixSettings {
    if (!existsSync(this.path)) {
      const settings = PhoenixSettingsSchema.parse(DEFAULT_PHOENIX_SETTINGS)
      writeJsonAtomically(this.path, settings)
      return settings
    }

    const candidate: unknown = JSON.parse(readFileSync(this.path, 'utf8'))
    return PhoenixSettingsSchema.parse(candidate)
  }
}

export class JsonRuntimeSystemSnapshotWriter implements RuntimeSystemSnapshotWriter {
  public constructor (private readonly path: string) {}

  public write (candidate: RuntimeSystemSnapshot): void {
    writeJsonAtomically(this.path, RuntimeSystemSnapshotSchema.parse(candidate))
  }
}

function writeJsonAtomically (path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp-${process.pid}`
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(temporaryPath, path)
}
