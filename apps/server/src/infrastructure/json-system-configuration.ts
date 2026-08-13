import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  ControlGridLayoutSchema,
  PhoenixSettingsSchema,
  RuntimeSystemSnapshotSchema,
  type ControlGridLayout,
  type PhoenixSettings,
  type RuntimeSystemSnapshot
} from '@phoenix/contracts'
import type {
  ControlGridLayoutRepository,
  RuntimeSystemSnapshotWriter,
  SystemSettingsRepository
} from '../domain/system-configuration.js'
import { DEFAULT_CONTROL_GRID_LAYOUT } from './default-control-grid-layout.js'

export const DEFAULT_PHOENIX_SETTINGS: PhoenixSettings = {
  version: 1,
  controls: {
    enabled: true,
    backend: 'auto',
    layout: DEFAULT_CONTROL_GRID_LAYOUT
  },
  modules: {
    macros: { enabled: false, copilotExecution: false, dangerousExecution: false },
    numpadCommands: { enabled: false, inputAdapter: 'browser' }
  }
}

export class JsonSystemSettingsRepository implements SystemSettingsRepository, ControlGridLayoutRepository {
  public constructor (private readonly path: string) {}

  public loadOrCreate (): PhoenixSettings {
    if (!existsSync(this.path)) {
      const settings = PhoenixSettingsSchema.parse(DEFAULT_PHOENIX_SETTINGS)
      writeJsonAtomically(this.path, settings)
      return settings
    }

    const candidate: unknown = JSON.parse(readFileSync(this.path, 'utf8'))
    const migrated = migrateSettings(candidate)
    const parsed = PhoenixSettingsSchema.parse(migrated)
    if (migrated !== candidate) this.save(parsed)
    if (parsed.controls.layout.pages.length > 0) return parsed

    const settings = {
      ...parsed,
      controls: { ...parsed.controls, layout: DEFAULT_CONTROL_GRID_LAYOUT }
    }
    this.save(settings)
    return settings
  }

  public save (candidate: PhoenixSettings): void {
    writeJsonAtomically(this.path, PhoenixSettingsSchema.parse(candidate))
  }

  public getLayout (): ControlGridLayout {
    return this.loadOrCreate().controls.layout
  }

  public saveLayout (candidate: ControlGridLayout): ControlGridLayout {
    const layout = ControlGridLayoutSchema.parse(candidate)
    const settings = this.loadOrCreate()
    this.save({ ...settings, controls: { ...settings.controls, layout } })
    return layout
  }
}

function migrateSettings (candidate: unknown): unknown {
  if (!isRecord(candidate)) return candidate
  const normalized = isRecord(candidate.modules)
    ? candidate
    : { ...candidate, modules: DEFAULT_PHOENIX_SETTINGS.modules }
  if (!isRecord(normalized.controls) || !isRecord(normalized.controls.layout)) {
    return normalized
  }
  if (normalized.controls.layout.version === 1) {
    return {
      ...normalized,
      controls: { ...normalized.controls, layout: DEFAULT_CONTROL_GRID_LAYOUT }
    }
  }
  const layout = normalized.controls.layout
  if (!Array.isArray(layout.pages)) return normalized
  const version3 = layout.version === 2
    ? {
        ...layout,
        version: 3,
        pages: layout.pages.map(page => !isRecord(page) || !Array.isArray(page.cells)
          ? page
          : {
              ...page,
              cells: page.cells.map(cell => !isRecord(cell) || cell.actionId !== 'elite.SilentRunning'
                ? cell
                : { ...cell, actionId: null })
            })
      }
    : layout
  if (version3.version !== 3 || !Array.isArray(version3.pages)) return normalized
  return {
    ...normalized,
    controls: {
      ...normalized.controls,
      layout: {
        ...version3,
        version: 4,
        pages: version3.pages.map(page => !isRecord(page) || !Array.isArray(page.cells)
          ? page
          : {
              ...page,
              cells: page.cells.map(cell => !isRecord(cell)
                ? cell
                : {
                    position: cell.position,
                    ...(cell.span === undefined ? {} : { span: cell.span }),
                    target: typeof cell.actionId === 'string'
                      ? { type: 'game-action', actionId: cell.actionId }
                      : null
                  })
            })
      }
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
  mkdirSync(dirname(path), { recursive: true })
  const temporaryPath = `${path}.tmp-${process.pid}`
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(temporaryPath, path)
}
