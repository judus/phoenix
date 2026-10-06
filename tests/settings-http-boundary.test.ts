import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test, vi } from 'vitest'
import { PhoenixApplication, type PhoenixApplicationOptions } from '../apps/server/src/phoenix-application.js'
import { PairingAccessController } from '../apps/server/src/infrastructure/pairing-access-controller.js'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'
import { InMemoryOpenAiSecretRepository } from '../apps/server/src/infrastructure/json-openai-secret-repository.js'
import { DefaultCopilotCapabilityService } from '../apps/server/src/application/copilot-capability-service.js'

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

test('invalid Settings input is rejected before any persistence', async () => {
  const repository = new InMemorySystemSettingsRepository()
  const secrets = new InMemoryOpenAiSecretRepository()
  await withServer(async origin => {
    const save = vi.spyOn(repository, 'save')
    const saveSecret = vi.spyOn(secrets, 'save')
    try {
      for (const path of ['general', 'modules', 'copilot', 'openai-key']) {
        for (const body of ['', '{', ' ', 'null', '{}', ' '.repeat(65537)]) {
          const response = await fetch(`${origin}/api/settings/${path}`, {
            method: 'PUT', headers: { 'content-type': 'application/json' }, body
          })
          expect(response.status).toBe(400)
          await expect(response.json()).resolves.toMatchObject({ error: { code: 'invalid_request', message: expect.any(String) } })
        }
      }
      expect(save).not.toHaveBeenCalled()
      expect(saveSecret).not.toHaveBeenCalled()
    } finally { save.mockRestore(); saveSecret.mockRestore() }
  }, { systemSettingsRepository: repository, openAiSecretRepository: secrets })
})

test.each(['general', 'modules', 'copilot'])('valid %s Settings storage failures are server errors and allow retry', async path => {
  const repository = new InMemorySystemSettingsRepository()
  await withServer(async origin => {
    const client = new PhoenixApiClient(origin)
    const input = path === 'general' ? { controlsEnabled: false }
      : path === 'modules' ? await client.getModuleSettings()
        : { provider: 'openai', permissions: { version: 2, enabledCapabilityIds: [] } }
    for (const operation of ['loadOrCreate', 'save'] as const) {
      const failure = vi.spyOn(repository, operation).mockImplementationOnce(() => { throw new Error('Synthetic storage failure') })
      try {
        const response = await fetch(`${origin}/api/settings/${path}`, {
          method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input)
        })
        expect(response.status).toBe(500)
        await expect(response.json()).resolves.toEqual({ error: { code: 'internal_error', message: 'Synthetic storage failure' } })
      } finally { failure.mockRestore() }
      const retry = await fetch(`${origin}/api/settings/${path}`, { method: 'PUT', body: JSON.stringify(input) })
      expect(retry.status).toBe(200)
    }
  }, { systemSettingsRepository: repository })
})

test('OpenAI secret persistence failures are server errors and allow retry', async () => {
  const secrets = new InMemoryOpenAiSecretRepository()
  await withServer(async origin => {
    const save = vi.spyOn(secrets, 'save').mockImplementationOnce(() => { throw new Error('Synthetic storage failure') })
    try {
      const response = await fetch(`${origin}/api/settings/openai-key`, {
        method: 'PUT', body: JSON.stringify({ apiKey: 'sk-test-settings-key' })
      })
      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({ error: {
        code: 'internal_error', message: 'Synthetic storage failure'
      } })
      expect(secrets.get()).toBeUndefined()
    } finally { save.mockRestore() }
    expect((await fetch(`${origin}/api/settings/openai-key`, { method: 'PUT',
      body: JSON.stringify({ apiKey: 'sk-test-settings-key' }) })).status).toBe(200)
  }, { openAiSecretRepository: secrets })
})

test.each(['saveInstallationPolicy', 'catalogue'] as const)('Copilot %s failures after validation are server errors', async operation => {
  await withServer(async origin => {
    const failure = vi.spyOn(DefaultCopilotCapabilityService.prototype, operation)
      .mockImplementationOnce(() => { throw new Error('Synthetic capability failure') })
    try {
      const response = await fetch(`${origin}/api/settings/copilot`, { method: 'PUT',
        body: JSON.stringify({ provider: 'openai', permissions: { version: 2, enabledCapabilityIds: [] } }) })
      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({ error: { code: 'internal_error', message: 'Synthetic capability failure' } })
    } finally { failure.mockRestore() }
  })
})

test('Copilot response schema failures are server errors, not invalid requests', async () => {
  await withServer(async origin => {
    const original = DefaultCopilotCapabilityService.prototype.catalogue
    const catalogue = vi.spyOn(DefaultCopilotCapabilityService.prototype, 'catalogue')
      .mockImplementation(function (this: DefaultCopilotCapabilityService, policy) {
        const result = original.call(this, policy)
        // Policy normalization passes a policy; the response catalogue does not.
        return policy ? result : { ...result, load: { ...result.load, score: NaN } }
      })
    try {
      const response = await fetch(`${origin}/api/settings/copilot`, { method: 'PUT',
        body: JSON.stringify({ provider: 'openai', permissions: { version: 2, enabledCapabilityIds: [] } }) })
      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toMatchObject({ error: { code: 'internal_error' } })
    } finally { catalogue.mockRestore() }
  })
})

test('Copilot provider persistence failures remain server errors after policy persistence', async () => {
  const repository = new InMemorySystemSettingsRepository()
  await withServer(async origin => {
    const original = repository.save.bind(repository)
    const save = vi.spyOn(repository, 'save')
      .mockImplementationOnce(original)
      .mockImplementationOnce(() => { throw new Error('Synthetic provider storage failure') })
    try {
      const response = await fetch(`${origin}/api/settings/copilot`, { method: 'PUT',
        body: JSON.stringify({ provider: 'openai', permissions: { version: 2, enabledCapabilityIds: [] } }) })
      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({ error: {
        code: 'internal_error', message: 'Synthetic provider storage failure'
      } })
      expect(save).toHaveBeenCalledTimes(2)
    } finally { save.mockRestore() }
  }, { systemSettingsRepository: repository })
})

test('OpenAI status read failures after persistence are server errors', async () => {
  const secrets = new InMemoryOpenAiSecretRepository()
  await withServer(async origin => {
    const get = vi.spyOn(secrets, 'get').mockImplementationOnce(() => { throw new Error('Synthetic secret read failure') })
    try {
      const response = await fetch(`${origin}/api/settings/openai-key`, { method: 'PUT',
        body: JSON.stringify({ apiKey: 'sk-test-settings-key' }) })
      expect(response.status).toBe(500)
      await expect(response.json()).resolves.toEqual({ error: {
        code: 'internal_error', message: 'Synthetic secret read failure'
      } })
    } finally { get.mockRestore() }
    expect(secrets.get()).toBe('sk-test-settings-key')
  }, { openAiSecretRepository: secrets })
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
