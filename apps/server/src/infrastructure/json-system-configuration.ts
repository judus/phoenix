import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { ControlDeckConfigurationSchema } from '@jdu/control-deck-core'
import {
  ControlGridLayoutSchema,
  PhoenixSettingsSchema,
  RuntimeSystemSnapshotSchema,
  controlDeckConfigurationToControlGridLayout,
  controlGridLayoutToControlDeckConfiguration,
  mergeControlGridLayoutIntoControlDeckConfiguration,
  type ControlGridLayout,
  type ControlDeckConfiguration,
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
  version: 1,
  copilot: {
    activeProfileId: 'marin',
    permissions: { gameActions: false, macros: false, dangerousActions: false }
  },
  controls: {
    enabled: true,
    backend: 'auto',
    deckConfiguration: controlGridLayoutToControlDeckConfiguration(DEFAULT_CONTROL_GRID_LAYOUT)
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
    if (parsed.controls.deckConfiguration.decks.length > 0) return parsed

    const settings = {
      ...parsed,
      controls: {
        ...parsed.controls,
        deckConfiguration: controlGridLayoutToControlDeckConfiguration(DEFAULT_CONTROL_GRID_LAYOUT)
      }
    }
    this.save(settings)
    return settings
  }

  public save (candidate: PhoenixSettings): void {
    writeJsonAtomically(this.path, PhoenixSettingsSchema.parse(candidate))
  }

  public getLayout (): ControlGridLayout {
    return controlDeckConfigurationToControlGridLayout(this.loadOrCreate().controls.deckConfiguration)
  }

  public getConfiguration (): ControlDeckConfiguration {
    return this.loadOrCreate().controls.deckConfiguration
  }

  public saveConfiguration (candidate: ControlDeckConfiguration): ControlDeckConfiguration {
    const configuration = ControlDeckConfigurationSchema.parse(candidate)
    const settings = this.loadOrCreate()
    this.save({ ...settings, controls: { ...settings.controls, deckConfiguration: configuration } })
    return this.getConfiguration()
  }

  public saveLayout (candidate: ControlGridLayout): ControlGridLayout {
    const layout = ControlGridLayoutSchema.parse(candidate)
    const settings = this.loadOrCreate()
    this.save({
      ...settings,
      controls: {
        ...settings.controls,
        deckConfiguration: mergeControlGridLayoutIntoControlDeckConfiguration(
          settings.controls.deckConfiguration,
          layout
        )
      }
    })
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
  const withModules = isRecord(candidate.modules)
    ? candidate
    : { ...candidate, modules: DEFAULT_PHOENIX_SETTINGS.modules }
  const normalized = isRecord(withModules.modules) && ('macros' in withModules.modules || (
    isRecord(withModules.modules.numpadCommands) && 'enabled' in withModules.modules.numpadCommands
  ))
    ? {
        ...withModules,
        modules: {
          numpadCommands: {
            ...(isRecord(withModules.modules.numpadCommands) ? withModules.modules.numpadCommands : {}),
            enabled: undefined
          }
        }
      }
    : withModules
  if (!isRecord(normalized.controls) || isRecord(normalized.controls.deckConfiguration)) return normalized
  if (!isRecord(normalized.controls.layout)) return normalized
  const legacyLayout = migrateLegacyControlGridLayout(normalized.controls.layout)
  const { layout: _legacyLayout, ...controls } = normalized.controls
  return {
    ...normalized,
    controls: {
      ...controls,
      deckConfiguration: controlGridLayoutToControlDeckConfiguration(legacyLayout)
    }
  }
}

function migrateLegacyControlGridLayout (layout: Record<string, unknown>): ControlGridLayout {
  if (layout.version === 1) return DEFAULT_CONTROL_GRID_LAYOUT
  if (!Array.isArray(layout.pages)) return ControlGridLayoutSchema.parse(layout)
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
  return ControlGridLayoutSchema.parse(version4)
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
