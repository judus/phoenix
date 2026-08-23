import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { SettingsPage } from '../apps/web/src/features/settings/settings-page.js'
import { BrowserDevicePreferences } from '../apps/web/src/platform/storage/browser-device-preferences.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

test('device settings expose browser-local display and input preferences', async () => {
  const preferences = new BrowserDevicePreferences(new MemoryStorage())
  const api = settingsApi()
  const renderer = await act(async () => create(
    <SettingsPage
      api={api}
      audio={{ devices: { inputs: [], outputs: [] }, inputId: '', outputId: '', setInputId() {}, setOutputId() {} }}
      devicePreferences={preferences}
    />
  ))
  const markup = JSON.stringify(renderer.toJSON())

  expect(markup).toContain('Follow Copilot')
  expect(markup).toContain('Capture numpad')
  expect(markup).toContain('Variable font sizes')
  expect(markup).toContain('Copilot · OpenAI')
  expect(markup).toContain('Voice audio')
  expect(markup).toContain('Control permissions')
  expect(markup).toContain('Device pairing')
  expect(markup).not.toContain('Enable macros')
  await act(async () => renderer.unmount())
})

test('saved OpenAI configuration clearly reports that PHOENIX must restart', async () => {
  const api = settingsApi({ configured: true, source: 'stored', stored: true, restartRequired: true })
  const renderer = await act(async () => create(
    <SettingsPage
      api={api}
      audio={{ devices: { inputs: [], outputs: [] }, inputId: '', outputId: '', setInputId() {}, setOutputId() {} }}
      devicePreferences={new BrowserDevicePreferences(new MemoryStorage())}
    />
  ))
  const markup = JSON.stringify(renderer.toJSON())

  expect(markup).toContain('Restart required')
  expect(markup).toContain('OpenAI configuration changed. Restart PHOENIX to apply it.')
  await act(async () => renderer.unmount())
})

function settingsApi (openAi = { configured: false, source: 'none' as const, stored: false, restartRequired: false }): PhoenixApi {
  return {
    async getInstallationSettings() {
      return {
        controlsEnabled: true,
        copilotPermissions: { gameActions: false, macros: false, dangerousActions: false },
        openAi
      }
    },
    async getPairingStatus() { return { authenticated: true, installationId: 'test', pairingRequired: false } },
    async getCopilotProfiles() { return { activeProfileId: 'marin', profiles: [{ description: '', id: 'marin', mark: 'M', name: 'Marin', voice: 'marin' }] } },
    async getCopilotVoiceHost() { return { desiredConnected: false, desiredRevision: 0, host: null } }
  } as PhoenixApi
}

class MemoryStorage {
  private readonly values = new Map<string, string>()
  public getItem (key: string): string | null { return this.values.get(key) ?? null }
  public setItem (key: string, value: string): void { this.values.set(key, value) }
}
