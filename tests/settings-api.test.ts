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
    expect((await client.getInstallationSettings()).openAi).toEqual({
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

test('settings API persists installation control permissions', async () => {
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
    const saved = await client.saveInstallationSettings({
      controlsEnabled: false,
      copilotPermissions: { gameActions: true, macros: true, dangerousActions: false }
    })
    expect(saved).toMatchObject({
      controlsEnabled: false,
      copilotPermissions: { gameActions: true, macros: true, dangerousActions: false }
    })
    expect(await client.getInstallationSettings()).toEqual(saved)
  } finally {
    await application.stop()
  }
})
