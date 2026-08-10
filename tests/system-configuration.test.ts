import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { ControlGridLayoutSchema } from '@phoenix/contracts'
import type {
  GameActionOperation,
  InputBackendStatus,
  LogicalInputChord,
  PhoenixSettings
} from '@phoenix/contracts'
import { bootstrapControlBackend } from '../apps/server/src/application/control-backend-bootstrap.js'
import type { InputBackend } from '../apps/server/src/domain/game-actions.js'
import {
  DEFAULT_PHOENIX_SETTINGS,
  JsonRuntimeSystemSnapshotWriter,
  JsonSystemSettingsRepository
} from '../apps/server/src/infrastructure/json-system-configuration.js'

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

test('draft version-one control layouts migrate to the canonical version-three default', () => {
  const directory = temporaryDirectory()
  const path = join(directory, 'settings.json')
  writeFileSync(path, JSON.stringify({
    version: 1,
    controls: {
      enabled: true,
      backend: 'auto',
      layout: { version: 1, pages: [{ id: 'ship', label: 'Ship', category: 'ship', columns: 8, cells: [] }] }
    }
  }))

  const settings = new JsonSystemSettingsRepository(path).loadOrCreate()

  expect(settings.controls.layout).toEqual(DEFAULT_PHOENIX_SETTINGS.controls.layout)
  expect(JSON.parse(readFileSync(path, 'utf8')).controls.layout.version).toBe(3)
})

test('version-two layouts preserve user choices while removing the invalid silent-running action', () => {
  const directory = temporaryDirectory()
  const path = join(directory, 'settings.json')
  writeFileSync(path, JSON.stringify({
    version: 1,
    controls: {
      enabled: true,
      backend: 'auto',
      layout: {
        version: 2,
        pages: [{
          id: 'ship',
          label: 'Ship',
          category: 'ship',
          columns: 8,
          rows: 5,
          cells: [
            { position: 20, span: 1, actionId: 'elite.SilentRunning' },
            { position: 16, span: 1, actionId: 'elite.NightVisionToggle' }
          ]
        }]
      }
    }
  }))

  const settings = new JsonSystemSettingsRepository(path).loadOrCreate()
  const cells = settings.controls.layout.pages[0]?.cells

  expect(settings.controls.layout.version).toBe(3)
  expect(cells).toContainEqual({ position: 20, span: 1, actionId: null })
  expect(cells).toContainEqual({ position: 16, span: 1, actionId: 'elite.NightVisionToggle' })
})

test('automatic Linux startup selects xdotool and produces runtime diagnostics', () => {
  const result = bootstrapControlBackend(DEFAULT_PHOENIX_SETTINGS, {
    createXdotoolBackend: () => new StubInputBackend({
      id: 'linux-xdotool',
      available: true,
      simulated: false,
      detail: 'xdotool ready'
    }),
    environment: { XDG_SESSION_TYPE: 'x11' },
    now: () => new Date('2026-08-10T19:00:00.000Z'),
    platform: 'linux'
  })

  expect(result.backend.getStatus().id).toBe('linux-xdotool')
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

test('developer overrides and disabled user settings remain distinct', () => {
  const overridden = bootstrapControlBackend(DEFAULT_PHOENIX_SETTINGS, {
    environment: { PHOENIX_INPUT_BACKEND: 'recording' },
    platform: 'linux'
  })
  const disabledSettings: PhoenixSettings = {
    version: 1,
    controls: { enabled: false, backend: 'auto' }
  }
  const disabled = bootstrapControlBackend(disabledSettings, { platform: 'linux' })

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
  const snapshot = bootstrapControlBackend(DEFAULT_PHOENIX_SETTINGS, {
    environment: { PHOENIX_INPUT_BACKEND: 'recording' },
    now: () => new Date('2026-08-10T19:00:00.000Z'),
    platform: 'linux'
  }).snapshot

  new JsonRuntimeSystemSnapshotWriter(path).write(snapshot)

  expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual(snapshot)
})

test('control-grid layouts are persisted inside system settings', () => {
  const directory = temporaryDirectory()
  const path = join(directory, 'settings.json')
  const repository = new JsonSystemSettingsRepository(path)
  const settings = repository.loadOrCreate()
  const layout = {
    ...settings.controls.layout,
    pages: settings.controls.layout.pages.map(page => page.id === 'ship'
      ? { ...page, cells: [{ position: 1, actionId: 'elite.NightVisionToggle' }] }
      : page)
  }

  repository.saveLayout(layout)

  expect(repository.getLayout().pages.find(page => page.id === 'ship')?.cells).toEqual([
    { position: 1, span: 1, actionId: 'elite.NightVisionToggle' }
  ])
})

test('control-grid layouts reject overlapping cells and duplicate assignments', () => {
  expect(() => ControlGridLayoutSchema.parse({
    version: 3,
    pages: [{
      id: 'ship',
      label: 'Ship',
      category: 'ship',
      columns: 8,
      rows: 5,
      cells: [
        { position: 1, span: 2, actionId: 'elite.NightVisionToggle' },
        { position: 2, span: 1, actionId: 'elite.NightVisionToggle' }
      ]
    }]
  })).toThrow()
})

class StubInputBackend implements InputBackend {
  public constructor (private readonly status: InputBackendStatus) {}

  public getStatus (): InputBackendStatus {
    return this.status
  }

  public async send (_operation: GameActionOperation, _binding: LogicalInputChord): Promise<void> {}
}

function temporaryDirectory (): string {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-settings-'))
  temporaryDirectories.push(directory)
  return directory
}
