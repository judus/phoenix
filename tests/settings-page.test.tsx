import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { CopilotSettingsPage } from '../apps/web/src/features/settings/copilot-settings-page.js'
import { SettingsPage } from '../apps/web/src/features/settings/settings-page.js'
import { BrowserDevicePreferences } from '../apps/web/src/platform/storage/browser-device-preferences.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

test('device settings expose browser-local display and input preferences', async () => {
  const preferences = new BrowserDevicePreferences(new MemoryStorage())
  const api = settingsApi()
  const renderer = await act(async () => create(
    <SettingsPage
      api={api}
      devicePreferences={preferences}
    />
  ))
  const markup = JSON.stringify(renderer.toJSON())

  expect(markup).toContain('Follow Copilot')
  expect(markup).toContain('Capture numpad')
  expect(markup).toContain('Variable font size')
  expect(markup).toContain('Scale long Numpy and Control Deck labels')
  expect(markup).toContain('Presentation')
  expect(markup).toContain('UI scale')
  expect(markup).toContain('Game integration')
  expect(markup).not.toContain('OpenAI')
  await act(async () => renderer.unmount())
})

test('UI scale is applied after a pointer drag completes', async () => {
  const preferences = new BrowserDevicePreferences(new MemoryStorage())
  const renderer = await act(async () => create(
    <SettingsPage
      api={settingsApi()}
      devicePreferences={preferences}
    />
  ))
  const scale = renderer.root.findByProps({ 'aria-label': 'UI scale' })

  act(() => scale.props.onPointerDown())
  act(() => scale.props.onChange({ currentTarget: { value: '115' } }))

  expect(preferences.getSnapshot().uiScalePercent).toBe(100)
  expect(renderer.root.findByType('output').children.join('')).toBe('115%')

  act(() => scale.props.onPointerUp({ currentTarget: { value: '115' } }))

  expect(preferences.getSnapshot().uiScalePercent).toBe(115)
  await act(async () => renderer.unmount())
})

test('saved OpenAI configuration clearly reports that PHOENIX must restart', async () => {
  const api = settingsApi({ configured: true, source: 'stored', stored: true, restartRequired: true })
  const renderer = await act(async () => create(
    <CopilotSettingsPage
      api={api}
      audio={{ devices: { inputs: [], outputs: [] }, inputId: '', outputId: '', setInputId() {}, setOutputId() {} }}
    />
  ))
  const markup = JSON.stringify(renderer.toJSON())

  expect(markup).toContain('Restart required')
  expect(markup).toContain('OpenAI configuration changed. Restart PHOENIX to apply it.')
  expect(markup).toContain('AI provider')
  expect(markup).toContain('Only OpenAI is integrated currently.')
  expect(markup).toContain('AI load')
  expect(markup).toContain('Focused')
  expect(markup).toContain('External')
  expect(markup).not.toContain('tool:web.search_web')
  expect(markup).not.toContain('Dangerous actions')

  const external = renderer.root.findByProps({ className: 'capability-group' })
  act(() => external.props.onToggle({ currentTarget: { open: true } }))

  expect(JSON.stringify(renderer.toJSON())).toContain('tool:web.search_web')
  await act(async () => renderer.unmount())
})

function settingsApi (openAi = { configured: false, source: 'none' as const, stored: false, restartRequired: false }): PhoenixApi {
  return {
    async getGeneralSettings() {
      return { controlsEnabled: true }
    },
    async getCopilotSettings() {
      return {
        provider: 'openai',
        permissions: { version: 2, enabledCapabilityIds: ['tool:web.search_web'] },
        capabilities: {
          groups: [{
            id: 'tools.external',
            label: 'External',
            capabilities: [{
              id: 'tool:web.search_web',
              label: 'Search Web',
              description: 'Search the public web.',
              kind: 'fixed-tool',
              access: 'external',
              available: true,
              enabled: true,
              loadCost: 2,
              risk: null
            }],
            subgroups: []
          }],
          load: {
            score: 2,
            percentage: 2,
            level: 'focused',
            enabled: { fixedTools: 1, gameActions: 0, macros: 0, total: 1 }
          }
        },
        openAi
      }
    },
    async getModuleSettings() {
      return {
        currentShip: { moduleHealthAlertThreshold: 90 },
        numpadCommands: {
          inputAdapter: 'browser', presentation: 'tiles', alwaysConfirm: false, cancelAfterMs: 5000
        }
      }
    },
    async getPairingStatus() { return { authenticated: true, installationId: 'test', pairingRequired: false, serverDevice: false } },
    async getCopilotProfiles() { return { activeProfileId: 'marin', profiles: [{ description: '', id: 'marin', mark: 'M', name: 'Marin', voice: 'marin' }] } },
    async getCopilotVoiceHost() { return { desiredConnected: false, desiredRevision: 0, host: null } }
  } as PhoenixApi
}

class MemoryStorage {
  private readonly values = new Map<string, string>()
  public getItem (key: string): string | null { return this.values.get(key) ?? null }
  public setItem (key: string, value: string): void { this.values.set(key, value) }
}
