import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import type {
  KeyboardCommandConfiguration,
  KeyboardOutput,
  KeyboardOutputStatus,
  PlatformKeyboardOutputOptions
} from 'control-deck/adapter-keyboard'
import {
  ControlDeckConfigurationConflictError,
  type ControlDeckCommandOperation
} from 'control-deck/core'
import type {
  PhoenixSettings
} from '@phoenix/contracts'
import { bootstrapControlOutput } from '../apps/server/src/application/control-output-bootstrap.js'
import {
  DEFAULT_PHOENIX_SETTINGS,
  JsonRuntimeSystemSnapshotWriter,
  JsonSystemSettingsRepository
} from '../apps/server/src/infrastructure/json-system-configuration.js'
import { BLANK_CONTROL_DECK_CONFIGURATION } from '../apps/server/src/infrastructure/default-control-deck-configuration.js'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

test('JSON settings are created with auto-detection defaults and loaded again', () => {
  const directory = temporaryDirectory()
  const path = join(directory, 'nested', 'settings.json')
  const repository = new JsonSystemSettingsRepository(path)

  expect(repository.loadOrCreate()).toEqual(DEFAULT_PHOENIX_SETTINGS)
  expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(DEFAULT_PHOENIX_SETTINGS)
  expect(repository.loadOrCreate()).toEqual(DEFAULT_PHOENIX_SETTINGS)
})

test('invalid JSON settings fail validation instead of being silently overwritten', () => {
  const directory = temporaryDirectory()
  const path = join(directory, 'settings.json')
  writeFileSync(path, '{"version":1,"controls":{"enabled":"yes","backend":"auto"}}\n')

  expect(() => new JsonSystemSettingsRepository(path).loadOrCreate()).toThrow()
})

test('pre-contribution settings default on while an explicit opt-out survives disk reload', () => {
  const path = join(temporaryDirectory(), 'settings.json')
  const { community, ...previous } = DEFAULT_PHOENIX_SETTINGS
  writeFileSync(path, JSON.stringify(previous))
  const repository = new JsonSystemSettingsRepository(path)
  expect(repository.loadOrCreate().community).toEqual({ eddnEnabled: true, eddnChangedAt: 0 })
  repository.save({ ...repository.loadOrCreate(), community: { eddnEnabled: false, eddnChangedAt: 123 } })
  expect(new JsonSystemSettingsRepository(path).loadOrCreate().community).toEqual({ eddnEnabled: false, eddnChangedAt: 123 })
})

test('reading canonical settings preserves the file without rewriting it', () => {
  const path = join(temporaryDirectory(), 'settings.json')
  const original = `${JSON.stringify(DEFAULT_PHOENIX_SETTINGS)}\n`
  writeFileSync(path, original)
  const timestamp = new Date('2020-01-01T00:00:00Z')
  utimesSync(path, timestamp, timestamp)
  const modifiedAt = statSync(path).mtimeMs
  const repository = new JsonSystemSettingsRepository(path)

  expect(repository.loadOrCreate()).toEqual(DEFAULT_PHOENIX_SETTINGS)
  expect(repository.getConfiguration()).toEqual(DEFAULT_PHOENIX_SETTINGS.controls.deckConfiguration)
  expect(readFileSync(path, 'utf8')).toBe(original)
  expect(statSync(path).mtimeMs).toBe(modifiedAt)
})

test.each([false, true])('invalid customized deck configuration is preserved (legacy: %s)', legacy => {
  const path = join(temporaryDirectory(), 'settings.json')
  const settings = structuredClone(DEFAULT_PHOENIX_SETTINGS)
  const configuration = settings.controls.deckConfiguration
  if (legacy) {
    configuration.decks = configuration.decks.filter(deck => deck.context !== 'phoenix:quick')
    addLegacyMiscDeck(settings)
  }
  configuration.decks[0]!.name = 'My customized deck'
  configuration.decks[0]!.layout.columns = 0
  const original = JSON.stringify(settings)
  writeFileSync(path, original)

  expect(() => new JsonSystemSettingsRepository(path).loadOrCreate()).toThrow('Invalid PHOENIX settings')
  expect(readFileSync(path, 'utf8')).toBe(original)
})

test('version one settings migrate once to the capability permission schema', () => {
  const directory = temporaryDirectory()
  const path = join(directory, 'settings.json')
  writeFileSync(path, JSON.stringify({
    ...DEFAULT_PHOENIX_SETTINGS,
    version: 1,
    copilot: {
      activeProfileId: 'marin',
      permissions: { gameActions: true, macros: true, dangerousActions: true }
    }
  }))

  const settings = new JsonSystemSettingsRepository(path).loadOrCreate()

  expect(settings.version).toBe(3)
  expect(settings.copilot.provider).toBe('openai')
  expect(settings.copilot.permissions).toEqual(DEFAULT_PHOENIX_SETTINGS.copilot.permissions)
  expect(settings.copilot.profilePermissions.marin).toEqual(DEFAULT_PHOENIX_SETTINGS.copilot.permissions)
  expect(JSON.parse(readFileSync(path, 'utf8')).version).toBe(3)
})

test('capability permission version one migrates renamed tool identifiers once', () => {
  const directory = temporaryDirectory()
  const path = join(directory, 'settings.json')
  writeFileSync(path, JSON.stringify({
    ...DEFAULT_PHOENIX_SETTINGS,
    copilot: {
      ...DEFAULT_PHOENIX_SETTINGS.copilot,
      permissions: {
        version: 1,
        enabledCapabilityIds: [
          'tool:ships.get_definition',
          'tool:ships.find_shipyards',
          'tool:controls.execute',
          'command.elite.Lights'
        ]
      }
    }
  }))

  const settings = new JsonSystemSettingsRepository(path).loadOrCreate()

  expect(settings.copilot.permissions).toEqual({
    version: 2,
    enabledCapabilityIds: [
      'tool:ships.get_ship_definition',
      'tool:stations.find_shipyards_selling_ship',
      'tool:controls.execute_command',
      'command.elite.Lights'
    ]
  })
  expect(JSON.parse(readFileSync(path, 'utf8')).copilot.permissions.version).toBe(2)
})

test('profile permission migrations persist once without rewriting current policies afterward', () => {
  const path = join(temporaryDirectory(), 'settings.json')
  writeFileSync(path, JSON.stringify({
    ...DEFAULT_PHOENIX_SETTINGS,
    copilot: {
      ...DEFAULT_PHOENIX_SETTINGS.copilot,
      profilePermissions: { marin: { version: 1, enabledCapabilityIds: ['tool:controls.execute'] } }
    }
  }))
  const repository = new JsonSystemSettingsRepository(path)
  expect(repository.loadOrCreate().copilot.profilePermissions.marin).toEqual({
    version: 2, enabledCapabilityIds: ['tool:controls.execute_command']
  })
  const migrated = readFileSync(path, 'utf8')
  const timestamp = new Date('2020-01-01T00:00:00Z')
  utimesSync(path, timestamp, timestamp)
  const modifiedAt = statSync(path).mtimeMs

  repository.loadOrCreate()
  expect(readFileSync(path, 'utf8')).toBe(migrated)
  expect(statSync(path).mtimeMs).toBe(modifiedAt)
})

test('noncanonical deck data is discarded instead of imported', () => {
  const directory = temporaryDirectory()
  const path = join(directory, 'settings.json')
  writeFileSync(path, JSON.stringify({
    ...DEFAULT_PHOENIX_SETTINGS,
    controls: {
      enabled: true,
      backend: 'auto',
      layout: { version: 1, pages: [{ id: 'ship', label: 'Ship', category: 'ship', columns: 8, cells: [] }] }
    }
  }))

  const repository = new JsonSystemSettingsRepository(path)
  const settings = repository.loadOrCreate()

  expect(settings.controls.deckConfiguration).toEqual(BLANK_CONTROL_DECK_CONFIGURATION)
  expect(settings.controls.deckConfiguration.decks.every(deck => deck.elements.length === 0)).toBe(true)
  expect(JSON.parse(readFileSync(path, 'utf8')).controls).not.toHaveProperty('layout')
})

test('pre-Quick migration retires MSC, preserves the other decks and runs only once', () => {
  const path = join(temporaryDirectory(), 'settings.json')
  const settings = structuredClone(DEFAULT_PHOENIX_SETTINGS)
  const configuration = settings.controls.deckConfiguration
  configuration.decks = configuration.decks.filter(deck => deck.context !== 'phoenix:quick')
  configuration.groups = configuration.groups!.filter(group => group.id !== 'quick')
  addLegacyMiscDeck(settings)
  configuration.revision = 17
  configuration.decks[0]!.name = 'My customised ship deck'
  configuration.decks[0]!.appearance = { colorScheme: 'blue' }
  // Even a legacy deck whose ID happens to be quick must survive unchanged.
  configuration.decks[0]!.id = 'quick'
  writeFileSync(path, JSON.stringify(settings))
  const repository = new JsonSystemSettingsRepository(path)
  const migrated = repository.loadOrCreate().controls.deckConfiguration
  expect(migrated.decks.filter(deck => deck.context !== 'phoenix:quick')).toEqual(configuration.decks.filter(deck => deck.context !== 'phoenix:misc'))
  expect(migrated.groups!.filter(group => group.id !== 'quick-1')).toEqual(configuration.groups!.filter(group => group.id !== 'misc'))
  expect(migrated.decks[0]!.context).toBe('phoenix:quick')
  expect(migrated.revision).toBe(18)
  expect(migrated.decks.find(deck => deck.context === 'phoenix:quick')).toMatchObject({ id: 'quick-1', layout: { columns: 4, rows: 3 } })
  const timestamp = new Date('2020-01-01T00:00:00Z')
  utimesSync(path, timestamp, timestamp)
  const modifiedAt = statSync(path).mtimeMs
  expect(repository.loadOrCreate().controls.deckConfiguration).toEqual(migrated)
  expect(statSync(path).mtimeMs).toBe(modifiedAt)
})

test('ten-deck migration moves existing Quick access first and backs up retired MSC buttons', () => {
  const directory = temporaryDirectory()
  const path = join(directory, 'settings.json')
  const settings = structuredClone(DEFAULT_PHOENIX_SETTINGS)
  addLegacyMiscDeck(settings)
  const configuration = settings.controls.deckConfiguration
  const quick = configuration.decks.shift()!
  quick.name = 'My shortcuts'
  configuration.decks.push(quick)
  const misc = configuration.decks.find(deck => deck.context === 'phoenix:misc')!
  misc.elements = structuredClone(quick.elements)
  const original = `${JSON.stringify(settings)}\n`
  writeFileSync(path, original)
  const repository = new JsonSystemSettingsRepository(path)

  const migrated = repository.loadOrCreate().controls.deckConfiguration
  expect(migrated.decks).toEqual([quick, ...configuration.decks.filter(deck => !['phoenix:quick', 'phoenix:misc'].includes(deck.context!))])
  expect(migrated.decks).toHaveLength(9)
  expect(migrated.groups!.some(group => group.id === 'misc')).toBe(false)
  expect(migrated.revision).toBe(configuration.revision + 1)
  const backups = readdirSync(directory).filter(name => name.endsWith('.bak'))
  expect(backups).toHaveLength(1)
  expect(readFileSync(join(directory, backups[0]!), 'utf8')).toBe(original)
  if (process.platform !== 'win32') expect(statSync(join(directory, backups[0]!)).mode & 0o777).toBe(0o600)

  repository.saveConfiguration({ ...migrated, decks: [...migrated.decks].reverse() })
  expect(repository.getConfiguration().decks).toEqual([...migrated.decks].reverse())
  expect(readdirSync(directory).filter(name => name.endsWith('.bak'))).toEqual(backups)
})

test('invalid retired MSC data is not silently removed during migration', () => {
  const path = join(temporaryDirectory(), 'settings.json')
  const settings = structuredClone(DEFAULT_PHOENIX_SETTINGS)
  addLegacyMiscDeck(settings)
  settings.controls.deckConfiguration.decks.find(deck => deck.context === 'phoenix:misc')!.layout.columns = 0
  const original = JSON.stringify(settings)
  writeFileSync(path, original)
  expect(() => new JsonSystemSettingsRepository(path).loadOrCreate()).toThrow('Invalid PHOENIX settings')
  expect(readFileSync(path, 'utf8')).toBe(original)
})

test('automatic Linux startup selects xdotool and produces runtime diagnostics', () => {
  const result = bootstrapControlOutput(DEFAULT_PHOENIX_SETTINGS, {
    createPlatformOutput: () => new StubKeyboardOutput({
      available: true,
      simulated: false,
      detail: 'xdotool ready',
      platformRequirements: []
    }),
    environment: { XDG_SESSION_TYPE: 'x11' },
    now: () => new Date('2026-08-10T19:00:00.000Z'),
    platform: 'linux'
  })

  expect(result.id).toBe('linux-xdotool')
  expect(result.snapshot).toEqual({
    version: 1,
    generatedAt: '2026-08-10T19:00:00.000Z',
    platform: 'linux',
    session: 'x11',
    controls: {
      enabled: true,
      configuredBackend: 'auto',
      overrideBackend: null,
      effectiveBackend: 'linux-xdotool',
      available: true,
      simulated: false,
      detail: 'xdotool ready'
    }
  })
})

test('automatic Linux startup selects the Wayland portal and preserves its restore token', () => {
  let platformOptions: PlatformKeyboardOutputOptions | null = null
  const result = bootstrapControlOutput(DEFAULT_PHOENIX_SETTINGS, {
    createPlatformOutput: options => {
      platformOptions = options
      return new StubKeyboardOutput({
        available: true,
        simulated: false,
        detail: 'Wayland portal ready',
        platformRequirements: []
      })
    },
    environment: { XDG_SESSION_TYPE: 'wayland', WAYLAND_DISPLAY: 'wayland-0' },
    platform: 'linux',
    waylandRestoreTokenPath: '/tmp/phoenix-wayland-keyboard.json'
  })

  expect(result.id).toBe('linux-wayland-portal')
  expect(result.snapshot.controls).toMatchObject({
    effectiveBackend: 'linux-wayland-portal',
    available: true,
    detail: 'Wayland portal ready'
  })
  expect(platformOptions).toEqual({
    environment: { XDG_SESSION_TYPE: 'wayland', WAYLAND_DISPLAY: 'wayland-0' },
    platform: 'linux',
    waylandRestoreTokenPath: '/tmp/phoenix-wayland-keyboard.json'
  })
})

test('automatic Windows startup selects SendInput and produces runtime diagnostics', () => {
  const result = bootstrapControlOutput(DEFAULT_PHOENIX_SETTINGS, {
    createPlatformOutput: () => new StubKeyboardOutput({
      available: true,
      simulated: false,
      detail: 'SendInput ready',
      platformRequirements: []
    }),
    environment: { SESSIONNAME: 'Console' },
    now: () => new Date('2026-08-18T14:00:00.000Z'),
    platform: 'win32'
  })

  expect(result.id).toBe('windows-sendinput')
  expect(result.snapshot.controls).toEqual({
    enabled: true,
    configuredBackend: 'auto',
    overrideBackend: null,
    effectiveBackend: 'windows-sendinput',
    available: true,
    simulated: false,
    detail: 'SendInput ready'
  })
})

test('developer overrides and disabled user settings remain distinct', () => {
  const overridden = bootstrapControlOutput(DEFAULT_PHOENIX_SETTINGS, {
    environment: { PHOENIX_INPUT_BACKEND: 'recording' },
    platform: 'linux'
  })
  const disabledSettings: PhoenixSettings = {
    ...DEFAULT_PHOENIX_SETTINGS,
    controls: { ...DEFAULT_PHOENIX_SETTINGS.controls, enabled: false }
  }
  const disabled = bootstrapControlOutput(disabledSettings, { platform: 'linux' })

  expect(overridden.snapshot.controls).toMatchObject({
    configuredBackend: 'auto',
    overrideBackend: 'recording',
    effectiveBackend: 'recording',
    simulated: true
  })
  expect(disabled.snapshot.controls).toMatchObject({
    enabled: false,
    effectiveBackend: 'disabled',
    available: false
  })
})

test('runtime system diagnostics are written as validated JSON', () => {
  const directory = temporaryDirectory()
  const path = join(directory, 'runtime', 'system.json')
  const snapshot = bootstrapControlOutput(DEFAULT_PHOENIX_SETTINGS, {
    environment: { PHOENIX_INPUT_BACKEND: 'recording' },
    now: () => new Date('2026-08-10T19:00:00.000Z'),
    platform: 'linux'
  }).snapshot

  new JsonRuntimeSystemSnapshotWriter(path).write(snapshot)

  expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(snapshot)
})

test('Control Deck configurations are persisted inside system settings', () => {
  const directory = temporaryDirectory()
  const path = join(directory, 'settings.json')
  const repository = new JsonSystemSettingsRepository(path)
  repository.loadOrCreate()
  const current = repository.getConfiguration()
  const configuration = {
    ...current,
    decks: current.decks.map(deck => deck.context === 'phoenix:ship' ? { ...deck, elements: [] } : deck)
  }

  repository.saveConfiguration(configuration)

  expect(repository.getConfiguration().decks.find(deck => deck.context === 'phoenix:ship')?.elements).toEqual([])
  expect(JSON.parse(readFileSync(path, 'utf8')).controls).not.toHaveProperty('layout')
})

test('control-deck configuration saves increment revisions and reject stale writers', () => {
  const directory = temporaryDirectory()
  const repository = new JsonSystemSettingsRepository(join(directory, 'settings.json'))
  const firstReader = repository.getConfiguration()
  const staleReader = repository.getConfiguration()

  const saved = repository.saveConfiguration(firstReader)

  expect(saved.revision).toBe(firstReader.revision + 1)
  expect(repository.getConfiguration().revision).toBe(saved.revision)
  expect(() => repository.saveConfiguration(staleReader)).toThrow(ControlDeckConfigurationConflictError)
})

class StubKeyboardOutput implements KeyboardOutput {
  public constructor (private readonly status: KeyboardOutputStatus) {}

  public getStatus (): KeyboardOutputStatus {
    return this.status
  }

  public async send (_operation: ControlDeckCommandOperation, _binding: KeyboardCommandConfiguration): Promise<void> {}
}

function temporaryDirectory (): string {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-settings-'))
  temporaryDirectories.push(directory)
  return directory
}

function addLegacyMiscDeck (settings: PhoenixSettings): void {
  const configuration = settings.controls.deckConfiguration
  configuration.decks.push({
    ...structuredClone(configuration.decks.find(deck => deck.context === 'phoenix:emote')!),
    id: 'misc', groupId: 'misc', context: 'phoenix:misc'
  })
  configuration.groups!.push({ id: 'misc', name: 'Miscellaneous', description: '' })
}
