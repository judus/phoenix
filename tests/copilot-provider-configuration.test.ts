import { afterEach, expect, test, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { generateText } from 'ai'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'
import { InMemoryOpenAiSecretRepository } from '../apps/server/src/infrastructure/json-openai-secret-repository.js'
import { JsonApiKeyRepository } from '../apps/server/src/infrastructure/json-api-key-repository.js'
import { OpenAiConfigurationService } from '../apps/server/src/application/openai-configuration-service.js'
import { CopilotProviderConfiguration } from '../apps/server/src/application/copilot-provider-configuration.js'
import { createCopilotModel } from '../apps/server/src/infrastructure/configured-copilot.js'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { ApplicationPaths } from '../apps/server/src/infrastructure/application-paths.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

const directories: string[] = []
afterEach(() => { vi.unstubAllGlobals(); for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }) })
function directory () { const value = mkdtempSync(join(tmpdir(), 'phoenix-provider-test-')); directories.push(value); return value }

test('provider selection and private credentials remain independent of OpenAI voice/Galnet', () => {
  const path = directory()
  const settings = new InMemorySystemSettingsRepository()
  const openAi = new OpenAiConfigurationService(new InMemoryOpenAiSecretRepository('synthetic-openai-key-123456'))
  const repositories = { anthropic: new JsonApiKeyRepository(join(path, 'anthropic.json')),
    google: new JsonApiKeyRepository(join(path, 'google.json')) }
  const configuration = new CopilotProviderConfiguration(settings, openAi, repositories)
  configuration.save('anthropic', 'synthetic-anthropic-key-123456')
  const saved = settings.loadOrCreate()
  settings.save({ ...saved, copilot: { ...saved.copilot, provider: 'anthropic', model: 'fixture-claude' } })
  expect(configuration.restartRequired()).toBe(true)
  expect(configuration.active().provider).toBe('openai')
  const restarted = new CopilotProviderConfiguration(settings, openAi, repositories)
  expect(restarted.active()).toMatchObject({ provider: 'anthropic', model: 'fixture-claude', apiKey: 'synthetic-anthropic-key-123456' })
  expect(restarted.restartRequired()).toBe(false)
  expect(openAi.activeApiKey()).toBe('synthetic-openai-key-123456')
  expect(JSON.stringify(restarted.status())).not.toContain('synthetic')
  expect(JSON.parse(readFileSync(join(path, 'anthropic.json'), 'utf8'))).toEqual({ apiKey: 'synthetic-anthropic-key-123456' })
  if (process.platform !== 'win32') expect(statSync(join(path, 'anthropic.json')).mode & 0o777).toBe(0o600)
})

test.each(['openai', 'anthropic', 'google'] as const)('direct %s SDK adapter sends its native protocol, not Vercel Gateway', async provider => {
  const requests: Array<{ url: string, body: Record<string, unknown> }> = []
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) })
    const body = provider === 'openai' ? {
      id: 'resp_fixture', object: 'response', created_at: 0, model: 'fixture', status: 'completed', error: null,
      incomplete_details: null, output: [{ id: 'msg_fixture', type: 'message', role: 'assistant', status: 'completed',
        content: [{ type: 'output_text', text: 'Ready', annotations: [] }] }],
      usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 }
    } : provider === 'anthropic' ? {
      id: 'msg_fixture', type: 'message', role: 'assistant', model: 'fixture', content: [{ type: 'text', text: 'Ready' }],
      stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 }
    } : {
      candidates: [{ content: { role: 'model', parts: [{ text: 'Ready' }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 }
    }
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
  })
  const result = await generateText({ model: createCopilotModel({ provider, apiKey: 'synthetic-fixture-key-12345', model: 'fixture' }),
    prompt: 'Hello', maxRetries: 0 })
  expect(result.text).toBe('Ready')
  expect(requests).toHaveLength(1)
  expect(requests[0].url).toContain(provider === 'openai' ? 'api.openai.com/v1/responses' : provider === 'anthropic'
    ? 'api.anthropic.com/v1/messages' : 'generativelanguage.googleapis.com')
  expect(requests[0].url).not.toContain('vercel')
})

test('provider key HTTP settings persist without exposing keys and reject an unknown provider', async () => {
  const root = directory()
  const applicationPaths = new ApplicationPaths({ installRoot: process.cwd(), userRoot: root, environment: {} })
  const application = new PhoenixApplication({ applicationPaths, databasePath: ':memory:', eliteDirectory: null,
    host: '127.0.0.1', port: 0, copilot: null, copilotRealtime: null, openAiEnvironmentKey: null })
  try {
    const address = await application.start()
    const origin = `http://${address.host}:${address.port}`
    const api = new PhoenixApiClient(origin)
    const status = await api.saveCopilotProviderKey('google', 'synthetic-google-key-123456')
    expect(status).toMatchObject({ configured: true, stored: true, restartRequired: true })
    expect(JSON.stringify(status)).not.toContain('synthetic-google')
    const current = await api.getCopilotSettings()
    const selected = await api.saveCopilotSettings({ provider: 'google', model: 'fixture-gemini', permissions: current.permissions })
    expect(selected).toMatchObject({ provider: 'google', model: 'fixture-gemini', restartRequired: true,
      providerKey: { configured: true }, openAi: { configured: false } })
    const invalid = await fetch(`${origin}/api/settings/copilot/providers/unknown/key`, { method: 'PUT',
      headers: { 'content-type': 'application/json' }, body: JSON.stringify({ apiKey: 'synthetic-invalid-key-123456' }) })
    expect(invalid.status).toBe(400)
    await api.removeCopilotProviderKey('google')
    expect((await api.getCopilotSettings()).providerKey.configured).toBe(false)
  } finally { await application.stop() }
})
