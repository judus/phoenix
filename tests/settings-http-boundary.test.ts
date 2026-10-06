import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, vi } from 'vitest'
import { PhoenixApplication, type PhoenixApplicationOptions } from '../apps/server/src/phoenix-application.js'
import { PairingAccessController } from '../apps/server/src/infrastructure/pairing-access-controller.js'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

async function withServer(run: (origin: string) => Promise<void>, options: PhoenixApplicationOptions = {}) {
  const application = new PhoenixApplication({ databasePath: ':memory:', eliteDirectory: null,
    host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null, openAiEnvironmentKey: null, ...options })
  try {
    const address = await application.start()
    await run(`http://${address.host}:${address.port}`)
  } finally { await application.stop() }
}

test('Settings GETs preserve JSON transport headers and query-string matching', async () => {
  await withServer(async origin => {
    for (const path of ['general', 'modules', 'copilot', 'eddn']) {
      const response = await fetch(`${origin}/api/settings/${path}?ignored=yes`)
      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8')
      expect(response.headers.get('cache-control')).toBe('no-store')
      const body = await response.text()
      expect(Number(response.headers.get('content-length'))).toBe(Buffer.byteLength(body))
      expect(JSON.parse(body)).toBeTypeOf('object')
    }
    const client = new PhoenixApiClient(origin)
    const modules = await client.getModuleSettings()
    modules.numpadCommands.cancelAfterMs = 9000
    expect(await client.saveModuleSettings(modules)).toEqual(modules)
    expect(await client.getModuleSettings()).toEqual(modules)
  })
})

test('unknown Settings paths and unsupported methods fall through to the ordinary API 404', async () => {
  await withServer(async origin => {
    for (const [path, method] of [['general', 'POST'], ['general/', 'GET'], ['general-extra', 'GET'],
      ['openai-key', 'GET'], ['unknown', 'PUT']] as const) {
      const response = await fetch(`${origin}/api/settings/${path}`, { method })
      expect(response.status).toBe(404)
      await expect(response.json()).resolves.toMatchObject({ error: { code: 'not_found' } })
    }
    expect((await fetch(`${origin}/api/health`)).status).toBe(200)
    expect((await fetch(`${origin}/api/macros`)).status).toBe(200)
  })
})

test('older Settings handlers retain their existing validation error codes', async () => {
  await withServer(async origin => {
    for (const [path, code] of [['general', 'invalid_general_settings'], ['modules', 'invalid_module_settings'],
      ['copilot', 'invalid_copilot_settings'], ['openai-key', 'invalid_openai_key']] as const) {
      const response = await fetch(`${origin}/api/settings/${path}`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{'
      })
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toMatchObject({ error: { code } })
    }
  })
})

test('the extraction preserves legacy general-settings service-error mapping', async () => {
  const repository = new InMemorySystemSettingsRepository()
  await withServer(async origin => {
    const save = vi.spyOn(repository, 'save').mockImplementationOnce(() => { throw new Error('Synthetic storage failure') })
    try {
      const response = await fetch(`${origin}/api/settings/general`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{"controlsEnabled":false}'
      })
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ error: {
        code: 'invalid_general_settings', message: 'Synthetic storage failure'
      } })
    } finally { save.mockRestore() }
  }, { systemSettingsRepository: repository })
})

test('pairing rejects Settings requests before mutation, and authorizes them after a claim', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-settings-pairing-'))
  const accessControl = new PairingAccessController(join(directory, 'pairing.json'))
  const repository = new InMemorySystemSettingsRepository()
  try {
    await withServer(async origin => {
      const save = vi.spyOn(repository, 'save')
      try {
        for (const path of ['general', 'modules', 'copilot', 'eddn', 'openai-key']) {
          const response = await fetch(`${origin}/api/settings/${path}`, { method: 'PUT', body: '{' })
          expect(response.status).toBe(401)
          await expect(response.json()).resolves.toMatchObject({ error: { code: 'pairing_required' } })
        }
        expect(save).not.toHaveBeenCalled()
        const claim = await fetch(`${origin}/api/pairing/claim`, { method: 'POST',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: accessControl.pairingCode }) })
        const cookie = claim.headers.get('set-cookie')!.split(';')[0]!
        const accepted = await fetch(`${origin}/api/settings/general`, { method: 'PUT',
          headers: { cookie, 'content-type': 'application/json' }, body: '{"controlsEnabled":false}' })
        expect(accepted.status).toBe(200)
        await expect(accepted.json()).resolves.toEqual({ controlsEnabled: false })
        expect(save).toHaveBeenCalledOnce()
      } finally { save.mockRestore() }
    }, { accessControl, systemSettingsRepository: repository })
  } finally { rmSync(directory, { recursive: true, force: true }) }
})
