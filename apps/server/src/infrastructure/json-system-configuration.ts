import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
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
import {
  ensurePrivateDirectorySync,
  PRIVATE_FILE_MODE,
  restrictPrivateFileSync
} from './private-user-state.js'

export const DEFAULT_PHOENIX_SETTINGS: PhoenixSettings = {
  version: 2,
  copilot: {
    activeProfileId: 'marin',
    permissions: { gameActions: false, macros: false, dangerousActions: false }
  },
  controls: {
    enabled: true,
    backend: 'auto',
    layout: DEFAULT_CONTROL_GRID_LAYOUT
  },
  modules: {
    numpadCommands: {
      inputAdapter: 'browser',
      presentation: 'tiles',
      alwaysConfirm: false,
      cancelAfterMs: 5000,
      shortcuts: []
    }
  }
}

export class JsonSystemSettingsRepository implements SystemSettingsRepository, ControlGridLayoutRepository {
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

export class InMemorySystemSettingsRepository implements SystemSettingsRepository {
  private settings = PhoenixSettingsSchema.parse(DEFAULT_PHOENIX_SETTINGS)

  public loadOrCreate (): PhoenixSettings { return PhoenixSettingsSchema.parse(this.settings) }
  public save (settings: PhoenixSettings): void { this.settings = PhoenixSettingsSchema.parse(settings) }
}

function migrateSettings (candidate: unknown): unknown {
  if (!isRecord(candidate)) return candidate
  let changed = candidate.version !== 2
  let modules: unknown = candidate.modules
  if (!isRecord(modules)) {
    modules = DEFAULT_PHOENIX_SETTINGS.modules
    changed = true
  } else {
    const numpad = isRecord(modules.numpadCommands) ? modules.numpadCommands : {}
    const oldShortcuts = Array.isArray(numpad.shortcuts) ? numpad.shortcuts : null
    const shortcuts = oldShortcuts
      ? oldShortcuts.map(shortcut => migrateShortcut(shortcut))
      : numpad.shortcuts
    const oldModuleShape = 'macros' in modules || 'enabled' in numpad
    const shortcutsChanged = oldShortcuts !== null && Array.isArray(shortcuts) && shortcuts.some((shortcut, index) => shortcut !== oldShortcuts[index])
    if (oldModuleShape || shortcutsChanged) {
      modules = {
        numpadCommands: {
          ...numpad,
          enabled: undefined,
          shortcuts
        }
      }
      changed = true
    }
  }

  let controls: unknown = candidate.controls
  if (isRecord(controls) && isRecord(controls.layout)) {
    const layout = migrateLayout(controls.layout)
    if (layout !== controls.layout) {
      controls = { ...controls, layout }
      changed = true
    }
  }

  return changed ? { ...candidate, version: 2, modules, controls } : candidate
}

function migrateLayout (layout: Record<string, unknown>): unknown {
  if (layout.version === 1) return DEFAULT_CONTROL_GRID_LAYOUT
  if (!Array.isArray(layout.pages)) return layout
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
  const version4 = version3.version === 3 && Array.isArray(version3.pages)
    ? {
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
    : version3
  if (version4.version !== 4 || !Array.isArray(version4.pages)) return version4
  return {
    ...version4,
    version: 5,
    pages: version4.pages.map(page => !isRecord(page) || !Array.isArray(page.cells)
      ? page
      : {
          ...page,
          groupId: page.category,
          category: undefined,
          cells: page.cells.map(cell => !isRecord(cell)
            ? cell
            : {
                position: cell.position,
                ...(cell.span === undefined ? {} : { span: cell.span }),
                commandId: commandIdFromLegacyTarget(cell.target)
              })
        })
  }
}

function migrateShortcut (shortcut: unknown): unknown {
  if (!isRecord(shortcut) || 'commandId' in shortcut) return shortcut
  return { ...shortcut, commandId: commandIdFromLegacyTarget(shortcut.target), target: undefined }
}

function commandIdFromLegacyTarget (target: unknown): unknown {
  if (!isRecord(target) || typeof target.type !== 'string') return null
  if (target.type === 'game-action' && typeof target.actionId === 'string') return `command.${target.actionId}`
  if (target.type === 'navigation' && typeof target.destinationId === 'string') return `command.navigation.${target.destinationId}`
  if (target.type === 'macro' && typeof target.macroId === 'string') return `command.macro.${target.macroId}`
  return null
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
