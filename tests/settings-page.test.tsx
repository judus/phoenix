import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { SettingsPage } from '../apps/web/src/features/settings/settings-page.js'
import { BrowserDevicePreferences } from '../apps/web/src/platform/storage/browser-device-preferences.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

test('device settings expose only browser-local command following and numpad capture', async () => {
  const preferences = new BrowserDevicePreferences(new MemoryStorage())
  const api = settingsApi()
  const renderer = await act(async () => create(<SettingsPage api={api} devicePreferences={preferences} view="device" />))
  const markup = JSON.stringify(renderer.toJSON())

  expect(markup).toContain('Follow Copilot navigation')
  expect(markup).toContain('Capture physical numpad')
  expect(markup).not.toContain('Enable macros')
  await act(async () => renderer.unmount())
})

function settingsApi (): PhoenixApi {
  return {
    async getInstallationSettings() {
      return {
        controlsEnabled: true,
        copilotPermissions: { gameActions: false, macros: false, dangerousActions: false },
        openAi: { configured: false, source: 'none', stored: false, restartRequired: false }
      }
    },
    async getPairingStatus() { return { authenticated: true, installationId: 'test', pairingRequired: false } },
    async getCopilotProfiles() { return { activeProfileId: 'marin', profiles: [{ description: '', id: 'marin', mark: 'M', name: 'Marin', voice: 'marin' }] } },
    async getCopilotVoiceHost() { return { desiredConnected: false, host: null } }
  } as PhoenixApi
}

class MemoryStorage {
  private readonly values = new Map<string, string>()
  public getItem (key: string): string | null { return this.values.get(key) ?? null }
  public setItem (key: string, value: string): void { this.values.set(key, value) }
}
