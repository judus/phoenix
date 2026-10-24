import { mkdtempSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, vi } from 'vitest'
import type { PhoenixSettings } from '@phoenix/contracts'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { JsonSystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'
import { NotifyingSystemSettingsRepository } from '../apps/server/src/infrastructure/notifying-command-source-repositories.js'
import { CopilotProviderConfiguration } from '../apps/server/src/application/copilot-provider-configuration.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, renameSync: vi.fn(actual.renameSync) }
})

const input = { provider: 'google' as const, model: 'synthetic-model', permissions: {
  version: 2 as const, enabledCapabilityIds: ['tool:web.search_web', 'tool:unknown']
} }

test('one durable save commits provider/model and all permission ceilings together', async () => {
  await withSettings(async f => {
    const response = await f.put()
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      provider: 'google', model: 'synthetic-model', restartRequired: true,
      permissions: { enabledCapabilityIds: ['tool:web.search_web'] }
    })
    expect(f.saves()).toBe(1)
    expectCommitted(f.reopen(), f.before)
  })
})

test('failed atomic replacement preserves the whole old document; explicit retry commits once', async () => {
  await withSettings(async f => {
    vi.mocked(renameSync).mockImplementationOnce(() => { throw new Error('Synthetic replacement failure') })
    try {
      const response = await f.put()
      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({ error: { code: 'internal_error', message: 'Synthetic replacement failure' } })
      expect(f.reopen()).toEqual(f.before)
      expect(f.saves()).toBe(1)
    } finally { vi.mocked(renameSync).mockClear() }
    expect((await f.put()).status).toBe(200)
    expect(f.saves()).toBe(2)
    expectCommitted(f.reopen(), f.before)
  })
})

test('post-save publication failure reports a committed document and preserves it on reload/retry', async () => {
  await withSettings(async f => {
    f.failPublication(true)
    const response = await f.put()
    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toMatchObject({ error: {
      code: 'settings_committed', committed: true, retryable: false, stage: 'publication',
      message: expect.stringContaining('Settings were saved')
    } })
    expect(f.saves()).toBe(1)
    expectCommitted(f.reopen(), f.before)
    f.failPublication(false)
    expect(await f.client.getCopilotSettings()).toMatchObject({ provider: 'google', model: 'synthetic-model', restartRequired: true })
    expect((await f.put()).status).toBe(200)
    expect(f.saves()).toBe(2)
    expectCommitted(f.reopen(), f.before)
  })
})

test('post-save response failure is explicitly committed, not a false storage failure', async () => {
  await withSettings(async f => {
    const status = vi.spyOn(CopilotProviderConfiguration.prototype, 'status').mockImplementationOnce(() => { throw new Error('Synthetic status failure') })
    try {
      const response = await f.put()
      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toMatchObject({ error: {
        code: 'settings_committed', committed: true, retryable: false, stage: 'response',
        message: expect.stringContaining('Settings were saved')
      } })
      expect(f.saves()).toBe(1)
      expectCommitted(f.reopen(), f.before)
    } finally { status.mockRestore() }
  })
})

test('the browser API preserves saved/reload guidance without automatically retrying the mutation', async () => {
  await withSettings(async f => {
    f.failPublication(true)
    await expect(f.client.saveCopilotSettings(input)).rejects.toThrow('Settings were saved, but notifying connected screens failed. Reload the page')
    expect(f.saves()).toBe(1)
    expectCommitted(f.reopen(), f.before)
  })
})

test('invalid provider input never reaches persistence', async () => {
  await withSettings(async f => {
    const response = await f.put({ ...input, provider: 'invalid' })
    expect(response.status).toBe(400)
    expect(f.saves()).toBe(0)
    expect(f.reopen()).toEqual(f.before)
  })
})

function expectCommitted (saved: PhoenixSettings, before: PhoenixSettings) {
  expect(saved.copilot).toEqual({ ...before.copilot, provider: 'google', model: 'synthetic-model',
    permissions: { version: 2, enabledCapabilityIds: ['tool:web.search_web'] },
    profilePermissions: {
      marin: { version: 2, enabledCapabilityIds: ['tool:web.search_web'] },
      other: { version: 2, enabledCapabilityIds: [] }
    }
  })
  expect({ ...saved, copilot: before.copilot }).toEqual(before)
}

async function withSettings (run: (f: {
  before: PhoenixSettings, saves(): number, reopen(): PhoenixSettings,
  put(body?: unknown): Promise<Response>, failPublication(value: boolean): void, client: PhoenixApiClient
}) => Promise<void>) {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-settings-commit-'))
  const path = join(directory, 'settings.json')
  const disk = new JsonSystemSettingsRepository(path)
  const initial = disk.loadOrCreate()
  initial.modules.numpadCommands.cancelAfterMs = 4321
  initial.copilot.profilePermissions.other = { version: 2, enabledCapabilityIds: ['tool:commander.get_current_situation'] }
  disk.save(initial)
  const before = disk.loadOrCreate()
  let saves = 0
  let publicationFailure = false
  const repository = new NotifyingSystemSettingsRepository({
    loadOrCreate: () => disk.loadOrCreate(), save: settings => { saves++; disk.save(settings) }
  }, { publish: () => { if (publicationFailure) throw new Error('Synthetic publication failure') } })
  const app = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null,
    host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null, openAiEnvironmentKey: null,
    systemSettingsRepository: repository })
  try {
    const address = await app.start()
    saves = 0
    const origin = `http://${address.host}:${address.port}`
    await run({ before, saves: () => saves, reopen: () => new JsonSystemSettingsRepository(path).loadOrCreate(),
      put: (body = input) => fetch(`${origin}/api/settings/copilot`, { method: 'PUT', body: JSON.stringify(body) }),
      failPublication: value => { publicationFailure = value }, client: new PhoenixApiClient(origin) })
  } finally {
    await app.stop()
    rmSync(directory, { recursive: true, force: true })
  }
}
