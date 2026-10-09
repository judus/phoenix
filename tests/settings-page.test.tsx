import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { CopilotSettingsPage } from '../apps/web/src/features/settings/copilot-settings-page.js'
import { SettingsPage } from '../apps/web/src/features/settings/settings-page.js'
import { PairingSettingsPage } from '../apps/web/src/features/settings/pairing-settings-page.js'
import { CopilotPermissionEditor } from '../apps/web/src/components/copilot-permission-editor.js'
import { BrowserDevicePreferences } from '../apps/web/src/platform/storage/browser-device-preferences.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

test('device settings expose browser-local display and input preferences', async () => {
  const preferences = new BrowserDevicePreferences(new MemoryStorage())
  const api = settingsApi()
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(
    <SettingsPage
      api={api}
      devicePreferences={preferences}
    />
  ) })
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
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(
    <SettingsPage
      api={settingsApi()}
      devicePreferences={preferences}
    />
  ) })
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
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(
    <CopilotSettingsPage
      api={api}
      audio={{ devices: { inputs: [], outputs: [] }, inputId: '', outputId: '', setInputId() {}, setOutputId() {} }}
    />
  ) })
  const markup = JSON.stringify(renderer.toJSON())

  expect(markup).toContain('Restart required')
  expect(markup).toContain('OpenAI configuration changed. Restart PHOENIX to apply it.')
  expect(markup).toContain('AI provider')
  expect(markup).toContain('Only OpenAI is integrated currently.')
  expect(markup).toContain('Installation-wide permission ceiling')
  expect(markup).toContain('Each Copilot profile chooses its own capabilities within this limit')
  expect(renderer.root.findAllByProps({ className: 'copilot-load' })).toHaveLength(0)
  expect(markup).not.toContain('Focused —')
  expect(markup).not.toContain('AI overloaded')
  expect(markup).toContain('External')
  expect(markup).not.toContain('tool:web.search_web')
  expect(markup).not.toContain('Dangerous actions')

  const external = renderer.root.findByProps({ className: 'capability-group' })
  act(() => external.props.onToggle({ currentTarget: { open: true } }))

  expect(JSON.stringify(renderer.toJSON())).toContain('tool:web.search_web')
  await act(async () => renderer.unmount())
})

function settingsApi (openAi: Awaited<ReturnType<PhoenixApi['getCopilotSettings']>>['openAi'] = { configured: false, source: 'none', stored: false, restartRequired: false }): PhoenixApi {
  return {
    async getEddnStatus() {
      return { enabled: true, mode: 'unavailable', queued: 0, lastSuccessAt: null, losses: [], detail: 'Release review pending.', error: null }
    },
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
  } as unknown as PhoenixApi
}

class MemoryStorage {
  private readonly values = new Map<string, string>()
  public getItem (key: string): string | null { return this.values.get(key) ?? null }
  public setItem (key: string, value: string): void { this.values.set(key, value) }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}

test('general settings ignore a noncooperative old API bootstrap', async () => {
  const load = deferred<Awaited<ReturnType<PhoenixApi['getGeneralSettings']>>>()
  const old = { ...settingsApi(), getGeneralSettings: vi.fn().mockReturnValue(load.promise) }
  const current = { ...settingsApi(), getGeneralSettings: vi.fn().mockResolvedValue({ controlsEnabled: false }) }
  const preferences = new BrowserDevicePreferences(new MemoryStorage())
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<SettingsPage api={old} devicePreferences={preferences} />) })
  try {
    await act(async () => renderer.update(<SettingsPage api={current} devicePreferences={preferences} />))
    await act(async () => load.resolve({ controlsEnabled: true }))
    expect(renderer.root.findAllByType('input').find(input => input.props.type === 'checkbox' && input.props.disabled !== undefined)?.props.checked).toBe(false)
  } finally { await act(async () => renderer.unmount()) }
})

test('Copilot settings ignore a noncooperative old API bootstrap', async () => {
  const load = deferred<Awaited<ReturnType<PhoenixApi['getCopilotSettings']>>>()
  const old = { ...settingsApi(), getCopilotSettings: vi.fn().mockReturnValue(load.promise) }
  const audio = { devices: { inputs: [], outputs: [] }, inputId: '', outputId: '', setInputId() {}, setOutputId() {} }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<CopilotSettingsPage api={old} audio={audio} />) })
  try {
    await act(async () => renderer.update(<CopilotSettingsPage api={settingsApi()} audio={audio} />))
    await act(async () => load.resolve(await settingsApi({ configured: true, source: 'stored', stored: true, restartRequired: true }).getCopilotSettings()))
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Restart required')
  } finally { await act(async () => renderer.unmount()) }
})

test('general settings preserve a threshold edited while its previous value saves', async () => {
  const saved = deferred<Awaited<ReturnType<PhoenixApi['saveModuleSettings']>>>()
  const api = { ...settingsApi(), saveModuleSettings: vi.fn().mockReturnValue(saved.promise) }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<SettingsPage api={api} devicePreferences={new BrowserDevicePreferences(new MemoryStorage())} />) })
  try {
    act(() => renderer.root.findByProps({ 'aria-label': 'Module health warning threshold' }).props.onChange({ target: { value: '80' } }))
    act(() => renderer.root.findAllByType('button').find(button => button.children.join('') === 'Save')!.props.onClick())
    act(() => renderer.root.findByProps({ 'aria-label': 'Module health warning threshold' }).props.onChange({ target: { value: '70' } }))
    await act(async () => saved.resolve({ ...await api.getModuleSettings(), currentShip: { moduleHealthAlertThreshold: 80 } }))
    expect(api.saveModuleSettings).toHaveBeenCalledWith(expect.objectContaining({ currentShip: { moduleHealthAlertThreshold: 80 } }))
    expect(renderer.root.findByProps({ 'aria-label': 'Module health warning threshold' }).props.value).toBe(70)
    expect(renderer.root.findAllByType('button').find(button => button.children.join('') === 'Save')!.props.disabled).toBe(false)
  } finally { await act(async () => renderer.unmount()) }
})

test.each(['resolve', 'reject'] as const)('general settings ignore obsolete save %s after API replacement', async outcome => {
  const save = deferred<Awaited<ReturnType<PhoenixApi['saveGeneralSettings']>>>()
  const old = { ...settingsApi(), saveGeneralSettings: vi.fn().mockReturnValue(save.promise) }
  const preferences = new BrowserDevicePreferences(new MemoryStorage())
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<SettingsPage api={old} devicePreferences={preferences} />) })
  try {
    act(() => renderer.root.findAllByType('input').find(input => input.props.type === 'checkbox' && input.props.disabled !== undefined)!.props.onChange())
    await act(async () => renderer.update(<SettingsPage api={settingsApi()} devicePreferences={preferences} />))
    await act(async () => outcome === 'resolve' ? save.resolve({ controlsEnabled: false }) : save.reject(new Error('obsolete settings failure')))
    expect(old.saveGeneralSettings).toHaveBeenCalledOnce()
    expect(renderer.root.findAllByType('input').find(input => input.props.type === 'checkbox' && input.props.disabled !== undefined)?.props.checked).toBe(true)
    expect(JSON.stringify(renderer.toJSON())).not.toContain('obsolete settings failure')
  } finally { await act(async () => renderer.unmount()) }
})

test('API key save does not erase a replacement key typed while saving', async () => {
  const save = deferred<Awaited<ReturnType<PhoenixApi['saveOpenAiApiKey']>>>()
  const api = { ...settingsApi(), saveOpenAiApiKey: vi.fn().mockReturnValue(save.promise) }
  const audio = { devices: { inputs: [], outputs: [] }, inputId: '', outputId: '', setInputId() {}, setOutputId() {} }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<CopilotSettingsPage api={api} audio={audio} />) })
  try {
    act(() => renderer.root.findByProps({ 'aria-label': 'OpenAI API key' }).props.onChange({ target: { value: 'first-key-01234567890123456789' } }))
    act(() => renderer.root.findAllByType('button').find(button => button.children.join('') === 'Save')!.props.onClick())
    act(() => renderer.root.findByProps({ 'aria-label': 'OpenAI API key' }).props.onChange({ target: { value: 'replacement-key-01234567890123456789' } }))
    await act(async () => save.resolve({ configured: true, source: 'stored', stored: true, restartRequired: true }))
    expect(api.saveOpenAiApiKey).toHaveBeenCalledWith('first-key-01234567890123456789')
    expect(renderer.root.findByProps({ 'aria-label': 'Replacement OpenAI API key' }).props.value).toBe('replacement-key-01234567890123456789')
  } finally { await act(async () => renderer.unmount()) }
})

test('pairing bootstrap does not request administration after its API lifetime ends', async () => {
  const load = deferred<Awaited<ReturnType<PhoenixApi['getPairingStatus']>>>()
  const old = { ...settingsApi(), getPairingStatus: vi.fn().mockReturnValue(load.promise), getPairingInfo: vi.fn().mockResolvedValue({ pairingCode: 'OLD', access: [] }), getPairingDevices: vi.fn().mockResolvedValue({ devices: [], currentDeviceId: null }) }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<PairingSettingsPage api={old} />) })
  try {
    await act(async () => renderer.update(<PairingSettingsPage api={settingsApi()} />))
    await act(async () => load.resolve({ authenticated: true, installationId: 'obsolete', pairingRequired: false, serverDevice: true }))
    expect(old.getPairingInfo).not.toHaveBeenCalled()
    expect(JSON.stringify(renderer.toJSON())).not.toContain('obsolete')
  } finally { await act(async () => renderer.unmount()) }
})

test('a retained general-settings action cannot write through an obsolete API', async () => {
  const old = { ...settingsApi(), saveGeneralSettings: vi.fn().mockResolvedValue({ controlsEnabled: false }) }
  const preferences = new BrowserDevicePreferences(new MemoryStorage())
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<SettingsPage api={old} devicePreferences={preferences} />) })
  try {
    const retained = renderer.root.findAllByType('input').find(input => input.props.type === 'checkbox' && input.props.disabled !== undefined)!.props.onChange
    await act(async () => renderer.update(<SettingsPage api={settingsApi()} devicePreferences={preferences} />))
    await act(async () => retained())
    expect(old.saveGeneralSettings).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

test('earlier controls save cannot clear the pending threshold save', async () => {
  const controls = deferred<Awaited<ReturnType<PhoenixApi['saveGeneralSettings']>>>()
  const modules = deferred<Awaited<ReturnType<PhoenixApi['saveModuleSettings']>>>()
  const api = { ...settingsApi(), saveGeneralSettings: vi.fn().mockReturnValue(controls.promise), saveModuleSettings: vi.fn().mockReturnValue(modules.promise) }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<SettingsPage api={api} devicePreferences={new BrowserDevicePreferences(new MemoryStorage())} />) })
  try {
    act(() => renderer.root.findAllByType('input').find(input => input.props.type === 'checkbox' && input.props.disabled !== undefined)!.props.onChange())
    act(() => renderer.root.findByProps({ 'aria-label': 'Module health warning threshold' }).props.onChange({ target: { value: '80' } }))
    act(() => renderer.root.findAllByType('button').find(button => button.children.join('') === 'Save')!.props.onClick())
    await act(async () => controls.resolve({ controlsEnabled: false }))
    expect(renderer.root.findAllByType('button').some(button => button.props['aria-busy'])).toBe(true)
    await act(async () => modules.resolve({ ...await api.getModuleSettings(), currentShip: { moduleHealthAlertThreshold: 80 } }))
    expect(api.saveGeneralSettings).toHaveBeenCalledOnce()
    expect(api.saveModuleSettings).toHaveBeenCalledOnce()
  } finally { await act(async () => renderer.unmount()) }
})

test.each(['permissions-first', 'key-first'] as const)('overlapping permission/key saves preserve both results and pending ownership: %s', async order => {
  const permissions = deferred<Awaited<ReturnType<PhoenixApi['saveCopilotSettings']>>>()
  const key = deferred<Awaited<ReturnType<PhoenixApi['saveOpenAiApiKey']>>>()
  const api = { ...settingsApi(), saveCopilotSettings: vi.fn().mockReturnValue(permissions.promise), saveOpenAiApiKey: vi.fn().mockReturnValue(key.promise) }
  const audio = { devices: { inputs: [], outputs: [] }, inputId: '', outputId: '', setInputId() {}, setOutputId() {} }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<CopilotSettingsPage api={api} audio={audio} />) })
  try {
    act(() => renderer.root.findByType(CopilotPermissionEditor).props.onChange({ version: 2, enabledCapabilityIds: [] }))
    act(() => renderer.root.findByProps({ 'aria-label': 'OpenAI API key' }).props.onChange({ target: { value: 'key-01234567890123456789012345' } }))
    act(() => renderer.root.findAllByType('button').find(button => button.children.join('') === 'Save')!.props.onClick())
    const config = { ...await api.getCopilotSettings(), permissions: { version: 2 as const, enabledCapabilityIds: [] } }
    const openAi = { configured: true, source: 'stored' as const, stored: true, restartRequired: true }
    if (order === 'permissions-first') {
      await act(async () => permissions.resolve(config))
      expect(renderer.root.findAllByType('button').some(button => button.props['aria-busy'])).toBe(true)
      await act(async () => key.resolve(openAi))
    } else {
      await act(async () => key.resolve(openAi))
      await act(async () => permissions.resolve(config))
    }
    expect(renderer.root.findByProps({ 'aria-label': 'Replacement OpenAI API key' }).props.value).toBe('')
    expect(renderer.root.findByType(CopilotPermissionEditor).props.permissions.enabledCapabilityIds).toEqual([])
  } finally { await act(async () => renderer.unmount()) }
})

test.each(['unpair', 'revoke-all'] as const)('completed %s retains its authorization reload after the settings view unmounts', async action => {
  const completed = deferred<unknown>()
  const reload = vi.fn()
  vi.stubGlobal('location', { reload })
  const api = {
    ...settingsApi(),
    getPairingStatus: vi.fn().mockResolvedValue({ authenticated: true, installationId: 'test', pairingRequired: true, serverDevice: action === 'revoke-all' }),
    getPairingInfo: vi.fn().mockResolvedValue({ pairingCode: 'CODE', access: [] }),
    getPairingDevices: vi.fn().mockResolvedValue({ devices: [{ id: 'tablet', label: 'Tablet', pairedAt: '2026-10-04', lastSeenAt: '2026-10-04' }], currentDeviceId: null }),
    releasePairing: vi.fn().mockReturnValue(completed.promise),
    revokeAllPairingDevices: vi.fn().mockReturnValue(completed.promise)
  }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<PairingSettingsPage api={api} />) })
  try {
    act(() => renderer.root.findAllByType('button').find(button => button.children.join('') === (action === 'unpair' ? 'Unpair' : 'Revoke all'))!.props.onClick())
    await act(async () => renderer.unmount())
    await act(async () => completed.resolve(undefined))
    expect(reload).toHaveBeenCalledOnce()
    expect(action === 'unpair' ? api.releasePairing : api.revokeAllPairingDevices).toHaveBeenCalledOnce()
  } finally { vi.unstubAllGlobals() }
})
