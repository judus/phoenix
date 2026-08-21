import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import type {
  KeyboardCommandConfiguration,
  KeyboardOutput,
  KeyboardOutputStatus
} from '@jdu/control-deck-adapter-keyboard'
import {
  ControlDeckConfigurationConflictError,
  type ControlDeckCommandOperation
} from '@jdu/control-deck-core'
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

test('automatic Linux startup selects xdotool and produces runtime diagnostics', () => {
  const result = bootstrapControlOutput(DEFAULT_PHOENIX_SETTINGS, {
    createXdotoolOutput: () => new StubKeyboardOutput({
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

test('automatic Windows startup selects SendInput and produces runtime diagnostics', () => {
  const result = bootstrapControlOutput(DEFAULT_PHOENIX_SETTINGS, {
    createSendInputOutput: () => new StubKeyboardOutput({
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
