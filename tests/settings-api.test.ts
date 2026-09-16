import { expect, test } from 'vitest'
import { PhoenixApplication } from '../apps/server/src/phoenix-application.js'
import { InMemoryOpenAiSecretRepository } from '../apps/server/src/infrastructure/json-openai-secret-repository.js'
import { PhoenixApiClient } from '../apps/web/src/platform/api/phoenix-api-client.js'

test('settings API stores OpenAI secrets without returning key material', async () => {
  const secrets = new InMemoryOpenAiSecretRepository()
  const application = new PhoenixApplication({
    copilot: null,
    copilotRealtime: null,
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    openAiEnvironmentKey: null,
    openAiSecretRepository: secrets,
    port: 0
  })
  const address = await application.start()
  const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)

  try {
    expect((await client.getCopilotSettings()).openAi).toEqual({
      configured: false,
      restartRequired: false,
      source: 'none',
      stored: false
    })
    const status = await client.saveOpenAiApiKey('sk-test-abcdefghijklmnopqrstuvwxyz')
    expect(status).toEqual({ configured: true, restartRequired: true, source: 'stored', stored: true })
    expect(JSON.stringify(status)).not.toContain('abcdefghijklmnopqrstuvwxyz')
    expect(secrets.get()).toBe('sk-test-abcdefghijklmnopqrstuvwxyz')

    const removed = await client.removeOpenAiApiKey()
    expect(removed).toEqual({ configured: false, restartRequired: false, source: 'none', stored: false })
  } finally {
    await application.stop()
  }
})

test('settings API persists general and Copilot settings through domain-owned mutations', async () => {
  const application = new PhoenixApplication({
    copilot: null,
    copilotRealtime: null,
    databasePath: ':memory:',
    eliteDirectory: null,
    host: '127.0.0.1',
    openAiEnvironmentKey: null,
    port: 0
  })
  const address = await application.start()
  const client = new PhoenixApiClient(`http://${address.host}:${address.port}`)

  try {
    const general = await client.saveGeneralSettings({ controlsEnabled: false })
    const copilot = await client.saveCopilotSettings({
      provider: 'openai',
      permissions: { version: 2, enabledCapabilityIds: ['tool:web.search_web'] }
    })
    expect(copilot.permissions.enabledCapabilityIds).toEqual(['tool:web.search_web'])
    expect(copilot.capabilities.groups.flatMap(group => group.capabilities)
      .find(capability => capability.id === 'tool:web.search_web')).toMatchObject({ enabled: true })
    const injected = await client.getCopilotToolDiagnostics()
    expect(injected.tools).toHaveLength(1)
    expect(injected.tools[0]).toMatchObject({
      id: 'web.search_web',
      mcp: { name: 'web.search_web' },
      realtime: { name: 'phoenix_web_search_web', type: 'function' }
    })
    expect(await client.getGeneralSettings()).toEqual(general)
    expect(await client.getCopilotSettings()).toEqual(copilot)
  } finally {
    await application.stop()
  }
})
