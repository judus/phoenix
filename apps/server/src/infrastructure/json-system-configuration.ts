import { randomUUID } from 'node:crypto'
import { constants, copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  ControlDeckConfigurationConflictError,
  ControlDeckGridConfigurationSchema,
  removeControlDeck,
  type ControlDeckConfiguration,
  type ControlDeckConfigurationRepository
} from 'control-deck/core'
import {
  DEFAULT_MODULE_HEALTH_ALERT_THRESHOLD,
  PhoenixControlDeckConfigurationSchema,
  PHOENIX_CONTROL_CONTEXTS,
  PhoenixSettingsSchema,
  RuntimeSystemSnapshotSchema,
  type PhoenixSettings,
  type PhoenixControlDeckConfiguration,
  type RuntimeSystemSnapshot
} from '@phoenix/contracts'
import type {
  RuntimeSystemSnapshotWriter,
  SystemSettingsRepository
} from '../domain/system-configuration.js'
import {
  DEFAULT_COPILOT_ENABLED_CAPABILITY_IDS,
  migrateCopilotCapabilityIdsV1
} from '../domain/copilot-capabilities.js'
import { BLANK_CONTROL_DECK_CONFIGURATION, DEFAULT_CONTROL_DECK_CONFIGURATION } from './default-control-deck-configuration.js'
import {
  ensurePrivateDirectorySync,
  PRIVATE_FILE_MODE,
  restrictPrivateFileSync
} from './private-user-state.js'

export const DEFAULT_PHOENIX_SETTINGS: PhoenixSettings = {
  version: 3,
  community: { eddnEnabled: true, eddnChangedAt: 0 },
  copilot: {
    activeProfileId: 'marin',
    provider: 'openai',
    permissions: {
      version: 2,
      enabledCapabilityIds: [...DEFAULT_COPILOT_ENABLED_CAPABILITY_IDS]
    },
    profilePermissions: {
      marin: {
        version: 2,
        enabledCapabilityIds: [...DEFAULT_COPILOT_ENABLED_CAPABILITY_IDS]
      }
    }
  },
  controls: {
    enabled: true,
    backend: 'auto',
    deckConfiguration: DEFAULT_CONTROL_DECK_CONFIGURATION
  },
  modules: {
    currentShip: {
      moduleHealthAlertThreshold: DEFAULT_MODULE_HEALTH_ALERT_THRESHOLD
    },
    numpadCommands: {
      inputAdapter: 'browser',
      presentation: 'tiles',
      alwaysConfirm: false,
      cancelAfterMs: 5000
    }
  }
}

export class JsonSystemSettingsRepository implements SystemSettingsRepository, ControlDeckConfigurationRepository<PhoenixControlDeckConfiguration> {
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
    const normalized = migrateControlDeckConfiguration(migrateSettings(candidate))
    const validated = PhoenixSettingsSchema.safeParse(normalized)
    if (!validated.success) {
      throw new Error(`Invalid PHOENIX settings at ${this.path}: ${validated.error.message}`)
    }
    const settings = validated.data
    if (normalized !== candidate) {
      // Retiring MSC can remove configured buttons. Keep the original private
      // settings recoverable, and refuse the migration if the backup fails.
      const previous = isRecord(candidate) && isRecord(candidate.controls) ? candidate.controls.deckConfiguration : undefined
      if (isRecord(previous) && Array.isArray(previous.decks) && previous.decks.some(deck => isRecord(deck) && deck.context === 'phoenix:misc')) {
        copyFileSync(this.path, `${this.path}.before-deck-migration-${randomUUID()}.bak`, constants.COPYFILE_EXCL)
      }
      this.save(settings)
    }
    return settings
  }

  public save (candidate: PhoenixSettings): void {
    writeJsonAtomically(this.path, PhoenixSettingsSchema.parse(candidate))
  }

  public getConfiguration (): PhoenixControlDeckConfiguration {
    return this.loadOrCreate().controls.deckConfiguration
  }

  public saveConfiguration (candidate: ControlDeckConfiguration): PhoenixControlDeckConfiguration {
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

function migrateControlDeckConfiguration (candidate: unknown): unknown {
  if (!isRecord(candidate) || !isRecord(candidate.controls)) return candidate
  const previous = candidate.controls.deckConfiguration
  const migrated = migrateLegacyDecks(previous)
  if (migrated) return { ...candidate, controls: { ...candidate.controls, deckConfiguration: migrated } }
  if (PhoenixControlDeckConfigurationSchema.safeParse(previous).success) return candidate
  // Only the retired page/cell layout is deliberately replaced by a blank deck.
  // Invalid current configurations must survive on disk for diagnosis/recovery.
  const legacyLayout = candidate.controls.layout
  if (previous === undefined && isRecord(legacyLayout) && legacyLayout.version === 1 && Array.isArray(legacyLayout.pages)) {
    return {
      ...candidate,
      controls: {
        ...candidate.controls,
        deckConfiguration: BLANK_CONTROL_DECK_CONFIGURATION
      }
    }
  }
  return candidate
}

function migrateLegacyDecks (candidate: unknown): PhoenixControlDeckConfiguration | undefined {
  const parsed = ControlDeckGridConfigurationSchema.safeParse(candidate)
  if (!parsed.success) return undefined
  const previous = parsed.data
  // Only the known nine-deck (before Quick access) or ten-deck configurations
  // are eligible. Malformed or unrelated configurations must fail, not reset.
  const required = [...PHOENIX_CONTROL_CONTEXTS.filter(context => context !== 'phoenix:quick'), 'phoenix:misc']
  const contexts = new Set(previous.decks.map(deck => deck.context))
  if (contexts.size !== previous.decks.length || !required.every(context => contexts.has(context)) ||
    previous.decks.some(deck => deck.context !== 'phoenix:quick' && !required.includes(deck.context ?? ''))) return undefined

  const misc = previous.decks.find(deck => deck.context === 'phoenix:misc')!
  const configuration = removeControlDeck(previous, misc.id).configuration
  let quick = configuration.decks.find(deck => deck.context === 'phoenix:quick')
  if (!quick) {
    const groups = configuration.groups ?? []
    const usedIds = new Set([...configuration.decks, ...groups].map(item => item.id))
    let quickId = 'quick'
    for (let suffix = 1; usedIds.has(quickId); suffix += 1) quickId = `quick-${suffix}`
    quick = { ...DEFAULT_CONTROL_DECK_CONFIGURATION.decks.find(deck => deck.context === 'phoenix:quick')!, id: quickId, groupId: quickId }
    configuration.groups = [...groups, { ...DEFAULT_CONTROL_DECK_CONFIGURATION.groups!.find(group => group.id === 'quick')!, id: quickId }]
  }
  // The old migration appended Quick access, while CTR always showed it first.
  // Correct that once; subsequent saved order is authoritative for Numpy.
  const migrated = PhoenixControlDeckConfigurationSchema.safeParse({
    ...configuration,
    revision: previous.revision + 1,
    decks: [quick, ...configuration.decks.filter(deck => deck.context !== 'phoenix:quick')]
  })
  return migrated.success ? migrated.data : undefined
}

function migrateSettings (candidate: unknown): unknown {
  if (!isRecord(candidate)) return candidate
  const initial = candidate.version === 1 ? migrateVersionOneSettings(candidate) : candidate
  const versionTwo = migratePermissionPolicies(initial)
  const versionThree = isRecord(versionTwo) && versionTwo.version === 2
    ? migrateVersionTwoSettings(versionTwo)
    : versionTwo
  return migratePermissionPolicies(versionThree)
}

function migratePermissionPolicies (candidate: unknown): unknown {
  if (!isRecord(candidate) || !isRecord(candidate.copilot)) return candidate
  const permissions = migratePermissionPolicy(candidate.copilot.permissions)
  const currentProfiles = candidate.copilot.profilePermissions
  let profiles = currentProfiles
  if (isRecord(currentProfiles)) {
    const entries = Object.entries(currentProfiles).map(([id, policy]) => [id, migratePermissionPolicy(policy)] as const)
    if (entries.some(([id, policy]) => policy !== currentProfiles[id])) profiles = Object.fromEntries(entries)
  }
  if (permissions === candidate.copilot.permissions && profiles === currentProfiles) return candidate
  return {
    ...candidate,
    copilot: {
      ...candidate.copilot,
      permissions,
      ...(profiles === undefined ? {} : { profilePermissions: profiles })
    }
  }
}

function migratePermissionPolicy (candidate: unknown): unknown {
  if (!isRecord(candidate) || candidate.version !== 1 || !Array.isArray(candidate.enabledCapabilityIds)) return candidate
  return {
    version: 2,
    enabledCapabilityIds: migrateCopilotCapabilityIdsV1(
      candidate.enabledCapabilityIds.filter((id): id is string => typeof id === 'string')
    )
  }
}

function migrateVersionOneSettings (candidate: Record<string, unknown>): unknown {
  const copilot = isRecord(candidate.copilot) ? candidate.copilot : {}
  return {
    ...candidate,
    version: 2,
    copilot: {
      ...copilot,
      provider: copilot.provider ?? 'openai',
      permissions: {
        version: 2,
        enabledCapabilityIds: [...DEFAULT_COPILOT_ENABLED_CAPABILITY_IDS]
      }
    }
  }
}

function migrateVersionTwoSettings (candidate: Record<string, unknown>): unknown {
  const copilot = isRecord(candidate.copilot) ? candidate.copilot : {}
  const activeProfileId = typeof copilot.activeProfileId === 'string' ? copilot.activeProfileId : 'marin'
  const permissions = copilot.permissions
  return {
    ...candidate,
    version: 3,
    copilot: {
      ...copilot,
      profilePermissions: isRecord(permissions) ? { [activeProfileId]: permissions } : {}
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
