import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../apps/web/src/application/events/phoenix-event-hub.js'
import type { DevicePreferences } from '../apps/web/src/application/settings/device-preferences.js'
import { CopilotPermissionEditor } from '../apps/web/src/components/copilot-permission-editor.js'
import { CopilotPage } from '../apps/web/src/features/copilot/copilot-page.js'
import { CopilotVoiceProvider } from '../apps/web/src/features/copilot/copilot-voice-provider.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

const identity = { forScope: () => 'profile-test' }
const events = { subscribe: () => () => undefined } as unknown as PhoenixEventHub
const snapshot = { version: 2, audioInputId: '', audioOutputId: '', captureNumpad: true, currentShipLoadoutView: 'tiles', followCopilotNavigation: true, presentation: 'phoenix', shipCatalogueView: 'dossier', uiScalePercent: 100, variableCommandLabelSizes: true } as const
const preferences = { getSnapshot: () => snapshot, subscribe: () => () => undefined, update: () => undefined } as DevicePreferences

function document(id: string) {
  return { profile: { id, name: id, description: `${id} description`, mark: id[0]!, voice: 'marin' }, characterSpeech: `${id} speech`, characterText: `${id} text` }
}
function capabilities(id: string) {
  return { profileId: id, permissions: { version: 2 as const, enabledCapabilityIds: [id] }, installationPermissions: { version: 2 as const, enabledCapabilityIds: [id] }, capabilities: { groups: [], load: { score: 0, percentage: 0, level: 'focused' as const, enabled: { fixedTools: 0, gameActions: 0, macros: 0, total: 0 } } } }
}
function apiWith(patch: Partial<PhoenixApi> = {}): PhoenixApi {
  return {
    getCopilotProfiles: vi.fn().mockResolvedValue({ activeProfileId: 'Alpha', profiles: ['Alpha', 'Beta'].map(id => document(id).profile) }),
    getCopilotVoiceHost: vi.fn().mockResolvedValue({ desiredConnected: false, desiredRevision: 0, host: null }),
    getCopilotHistory: vi.fn().mockResolvedValue({ messages: [] }),
    getCopilotProfile: vi.fn().mockImplementation(async id => document(id)),
    getCopilotProfileCapabilities: vi.fn().mockImplementation(async id => capabilities(id)),
    ...patch
  } as PhoenixApi
}
function page(api: PhoenixApi, view: 'profiles' | 'chat' = 'profiles') {
  return <CopilotVoiceProvider api={api} clientIdentity={identity} devicePreferences={preferences} events={events}><CopilotPage api={api} clientIdentity={identity} events={events} view={view} /></CopilotVoiceProvider>
}
async function mount(api: PhoenixApi, view: 'profiles' | 'chat' = 'profiles'): Promise<ReactTestRenderer> {
  let renderer!: ReactTestRenderer
  await act(async () => { renderer = create(page(api, view)) })
  return renderer
}
function click(renderer: ReactTestRenderer, label: string) { renderer.root.findAll(node => node.type === 'button' || node.type === 'tr').find(node => node.props['aria-label'] === label || node.children.join('') === label)!.props.onClick() }
function selectedProfiles(renderer: ReactTestRenderer) { return renderer.root.findByType('table').findAllByType('tr').filter(row => row.props['aria-selected']).map(row => row.props['aria-label']) }
function name(renderer: ReactTestRenderer) { return renderer.root.findAllByType('input')[0]!.props.value }
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: unknown) => void
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail })
  return { promise, resolve, reject }
}

test('the active profile editor loads on entry without a profile-button click', async () => {
  const renderer = await mount(apiWith())
  try {
    expect(name(renderer)).toBe('Alpha')
    expect(selectedProfiles(renderer)).toEqual(['Alpha'])
    expect(renderer.root.findByType(CopilotPermissionEditor).props.permissions.enabledCapabilityIds).toEqual(['Alpha'])
    expect(renderer.root.findByType(CopilotPermissionEditor).props.profileLoad).toEqual(capabilities('Alpha').capabilities.load)
    expect(renderer.root.findAllByProps({ className: 'copilot-load' })).toHaveLength(1)
  } finally { await act(async () => renderer.unmount()) }
})

test('profile roster follows the editor without switching the chat profile', async () => {
  const api = apiWith({ selectCopilotProfile: vi.fn() })
  const renderer = await mount(api)
  try {
    await act(async () => click(renderer, 'Beta'))
    expect(name(renderer)).toBe('Beta')
    expect(selectedProfiles(renderer)).toEqual(['Beta'])
    const table = renderer.root.findByType('table')
    expect(table.props.className).toContain('data-table compact surface')
    expect(table.findByType('caption').children.join('')).toBe('Profiles to edit')
    for (const row of table.findAllByType('tr')) {
      expect(row.props.tabIndex).toBe(0)
      expect(row.findByType('th').props.scope).toBe('row')
    }
    expect(table.findAllByType('button')).toHaveLength(0)
    expect(api.selectCopilotProfile).not.toHaveBeenCalled()
    await act(async () => click(renderer, 'New profile'))
    expect(selectedProfiles(renderer)).toEqual([])
  } finally { await act(async () => renderer.unmount()) }
})

test.each(['Enter', ' '])('profile roster supports keyboard selection with %s', async key => {
  const renderer = await mount(apiWith())
  try {
    const row = renderer.root.findAllByType('tr').find(row => row.props['aria-label'] === 'Beta')!
    const preventDefault = vi.fn()
    await act(async () => row.props.onKeyDown({ key, preventDefault }))
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(name(renderer)).toBe('Beta')
    expect(selectedProfiles(renderer)).toEqual(['Beta'])
  } finally { await act(async () => renderer.unmount()) }
})

test('profiles header has breadcrumb and title only, with supporting text in the status slot', async () => {
  const renderer = await mount(apiWith())
  try {
    const header = renderer.root.findByProps({ className: 'page-header page-header-cockpit' })
    expect(header.props.className).toContain('page-header-cockpit')
    expect(header.findAllByType('p')).toHaveLength(0)
    expect(header.findAllByProps({ 'aria-label': 'Breadcrumb' })).toHaveLength(1)
    expect(header.findByProps({ className: 'page-status' }).children.join('')).toContain('Select, create, and tune Copilot characters.')
  } finally { await act(async () => renderer.unmount()) }
})

test('the load display follows the selected profile rather than the installation ceiling', async () => {
  const api = apiWith({ getCopilotProfileCapabilities: vi.fn().mockImplementation(async id => {
    const settings = capabilities(id)
    return { ...settings, capabilities: { ...settings.capabilities, load: {
      ...settings.capabilities.load, score: id === 'Alpha' ? 17 : 83, percentage: id === 'Alpha' ? 17 : 83,
      level: id === 'Alpha' ? 'focused' : 'broad'
    } } }
  }) })
  const renderer = await mount(api)
  try {
    expect(JSON.stringify(renderer.toJSON())).toContain('17%')
    await act(async () => click(renderer, 'Beta'))
    expect(renderer.root.findByType(CopilotPermissionEditor).props.profileLoad.percentage).toBe(83)
    expect(JSON.stringify(renderer.toJSON())).toContain('83%')
    expect(JSON.stringify(renderer.toJSON())).not.toContain('17%')
  } finally { await act(async () => renderer.unmount()) }
})

test.each(['resolve', 'reject'] as const)('profile reads ignore obsolete %s after another selection', async outcome => {
  const old = deferred<ReturnType<typeof document>>()
  const api = apiWith({ getCopilotProfile: vi.fn().mockImplementation(id => id === 'Alpha' ? old.promise : Promise.resolve(document(id))) })
  const renderer = await mount(api)
  try {
    act(() => click(renderer, 'Alpha'))
    await act(async () => click(renderer, 'Beta'))
    await act(async () => outcome === 'resolve' ? old.resolve(document('Alpha')) : old.reject(new Error('obsolete profile read')))
    expect(name(renderer)).toBe('Beta')
    expect(selectedProfiles(renderer)).toEqual(['Beta'])
    expect(JSON.stringify(renderer.toJSON())).not.toContain('obsolete profile read')
    expect(api.getCopilotProfile).toHaveBeenCalledWith('Alpha', expect.any(AbortSignal))
  } finally { await act(async () => renderer.unmount()) }
})

test('profile highlight stays with the loaded draft while another profile loads or fails', async () => {
  const loading = deferred<ReturnType<typeof document>>()
  const api = apiWith({ getCopilotProfile: vi.fn().mockImplementation(id => id === 'Beta' ? loading.promise : Promise.resolve(document(id))) })
  const renderer = await mount(api)
  try {
    act(() => click(renderer, 'Beta'))
    expect(selectedProfiles(renderer)).toEqual(['Alpha'])
    await act(async () => loading.reject(new Error('Profile unavailable')))
    expect(name(renderer)).toBe('Alpha')
    expect(selectedProfiles(renderer)).toEqual(['Alpha'])
  } finally { await act(async () => renderer.unmount()) }
})

test('new-profile template preparation cannot replace a newer selected profile', async () => {
  const template = deferred<ReturnType<typeof document>>()
  const api = apiWith({ getCopilotProfile: vi.fn().mockImplementation(id => id === 'Alpha' ? template.promise : Promise.resolve(document(id))) })
  const renderer = await mount(api)
  try {
    act(() => click(renderer, 'New profile'))
    await act(async () => click(renderer, 'Beta'))
    await act(async () => template.resolve(document('Alpha')))
    expect(name(renderer)).toBe('Beta')
  } finally { await act(async () => renderer.unmount()) }
})

test.each(['resolve', 'reject'] as const)('profile save %s cannot take ownership of a newer selection', async outcome => {
  const saved = deferred<ReturnType<typeof document>>()
  const api = apiWith({ updateCopilotProfile: vi.fn().mockReturnValue(saved.promise) })
  const renderer = await mount(api)
  try {
    await act(async () => click(renderer, 'Alpha'))
    act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
    await act(async () => click(renderer, 'Beta'))
    await act(async () => outcome === 'resolve' ? saved.resolve(document('Alpha')) : saved.reject(new Error('obsolete profile save')))
    expect(name(renderer)).toBe('Beta')
    expect(JSON.stringify(renderer.toJSON())).not.toContain('obsolete profile save')
    expect(api.updateCopilotProfile).toHaveBeenCalledOnce()
  } finally { await act(async () => renderer.unmount()) }
})

test('profile save preserves edits made while the requested snapshot persists', async () => {
  const saved = deferred<ReturnType<typeof document>>()
  const api = apiWith({ updateCopilotProfile: vi.fn().mockReturnValue(saved.promise) })
  const renderer = await mount(api)
  try {
    await act(async () => click(renderer, 'Alpha'))
    act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
    act(() => renderer.root.findAllByType('input')[0]!.props.onChange({ target: { value: 'New draft name' } }))
    await act(async () => saved.resolve(document('Alpha')))
    expect(name(renderer)).toBe('New draft name')
    expect(api.updateCopilotProfile).toHaveBeenCalledWith('Alpha', expect.objectContaining({ profile: expect.objectContaining({ name: 'Alpha' }) }))
  } finally { await act(async () => renderer.unmount()) }
})

test('profile permission save cannot replace another profile capabilities', async () => {
  const saved = deferred<ReturnType<typeof capabilities>>()
  const api = apiWith({ updateCopilotProfileCapabilities: vi.fn().mockReturnValue(saved.promise) })
  const renderer = await mount(api)
  try {
    await act(async () => click(renderer, 'Alpha'))
    act(() => renderer.root.findByType(CopilotPermissionEditor).props.onChange({ version: 2, enabledCapabilityIds: [] }))
    await act(async () => click(renderer, 'Beta'))
    await act(async () => saved.resolve(capabilities('Alpha')))
    expect(renderer.root.findByType(CopilotPermissionEditor).props.permissions.enabledCapabilityIds).toEqual(['Beta'])
  } finally { await act(async () => renderer.unmount()) }
})

test('profile read from an obsolete API cannot replace the current API draft', async () => {
  const old = deferred<ReturnType<typeof document>>()
  const api = apiWith({ getCopilotProfile: vi.fn().mockReturnValue(old.promise) })
  const current = apiWith()
  const renderer = await mount(api)
  try {
    act(() => click(renderer, 'Alpha'))
    await act(async () => renderer.update(page(current)))
    await act(async () => click(renderer, 'Beta'))
    await act(async () => old.resolve(document('Alpha')))
    expect(name(renderer)).toBe('Beta')
  } finally { await act(async () => renderer.unmount()) }
})

test('created profiles retain their persisted identity without losing edits made during creation', async () => {
  const saved = deferred<ReturnType<typeof document>>()
  const api = apiWith({ createCopilotProfile: vi.fn().mockReturnValue(saved.promise), updateCopilotProfile: vi.fn().mockImplementation(async id => document(id)) })
  const renderer = await mount(api)
  try {
    await act(async () => click(renderer, 'New profile'))
    act(() => renderer.root.findAllByType('input')[0]!.props.onChange({ target: { value: 'Created' } }))
    act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
    act(() => renderer.root.findAllByType('input')[0]!.props.onChange({ target: { value: 'Edited while creating' } }))
    await act(async () => saved.resolve(document('created')))
    expect(name(renderer)).toBe('Edited while creating')
    expect(renderer.root.findAllByType('button').some(button => button.children.join('') === 'Save profile')).toBe(true)
    await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
    expect(api.createCopilotProfile).toHaveBeenCalledOnce()
    expect(api.updateCopilotProfile).toHaveBeenCalledWith('created', expect.objectContaining({ profile: expect.objectContaining({ id: 'created', name: 'Edited while creating' }) }))
  } finally { await act(async () => renderer.unmount()) }
})

test.each(['replace', 'unmount'] as const)('obsolete chat stream cannot restart old history after %s', async change => {
  const completed = deferred<void>()
  let streamEvent!: Parameters<PhoenixApi['streamCopilotMessage']>[1]
  const history = vi.fn().mockResolvedValue({ messages: [] })
  const api = apiWith({ getCopilotHistory: history, streamCopilotMessage: vi.fn().mockImplementation((_input, receive) => { streamEvent = receive; return completed.promise }) })
  const current = apiWith({ getCopilotHistory: vi.fn().mockResolvedValue({ messages: [{ createdAt: '2026-10-04T12:00:00Z', id: 'new', role: 'assistant', text: 'Current API history' }] }) })
  const renderer = await mount(api, 'chat')
  try {
    act(() => renderer.root.findByType('textarea').props.onChange({ target: { value: 'Hello' } }))
    act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
    if (change === 'replace') await act(async () => renderer.update(page(current, 'chat')))
    else await act(async () => renderer.unmount())
    await act(async () => {
      streamEvent({ type: 'tool', callId: 'obsolete-call', status: 'complete', name: 'obsolete_tool' })
      completed.resolve()
    })
    expect(history).toHaveBeenCalledOnce()
    expect((api.streamCopilotMessage as ReturnType<typeof vi.fn>).mock.calls[0]![2].aborted).toBe(true)
    if (change === 'replace') {
      expect(JSON.stringify(renderer.toJSON())).toContain('Current API history')
      expect(JSON.stringify(renderer.toJSON())).not.toContain('obsolete_tool')
      expect(renderer.root.findByType('textarea').props.disabled).toBe(false)
    }
  } finally { if (change !== 'unmount') await act(async () => renderer.unmount()) }
})

test('retained chat submit cannot dispatch through an obsolete API', async () => {
  const api = apiWith({ streamCopilotMessage: vi.fn().mockResolvedValue(undefined) })
  const renderer = await mount(api, 'chat')
  try {
    act(() => renderer.root.findByType('textarea').props.onChange({ target: { value: 'Hello' } }))
    const retained = renderer.root.findByType('form').props.onSubmit
    await act(async () => renderer.update(page(apiWith(), 'chat')))
    await act(async () => retained({ preventDefault() {} }))
    expect(api.streamCopilotMessage).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

test('permission writes from the still-visible old editor cannot overwrite a newly loaded selection', async () => {
  const loading = deferred<ReturnType<typeof document>>()
  const permissions = deferred<ReturnType<typeof capabilities>>()
  const api = apiWith({ getCopilotProfile: vi.fn().mockImplementation(id => id === 'Beta' ? loading.promise : Promise.resolve(document(id))), updateCopilotProfileCapabilities: vi.fn().mockReturnValue(permissions.promise) })
  const renderer = await mount(api)
  try {
    await act(async () => click(renderer, 'Alpha'))
    act(() => click(renderer, 'Beta'))
    act(() => renderer.root.findByType(CopilotPermissionEditor).props.onChange({ version: 2, enabledCapabilityIds: [] }))
    await act(async () => loading.resolve(document('Beta')))
    await act(async () => permissions.resolve(capabilities('Alpha')))
    expect(renderer.root.findByType(CopilotPermissionEditor).props.permissions.enabledCapabilityIds).toEqual(['Beta'])
    expect(api.updateCopilotProfileCapabilities).toHaveBeenCalledWith('Alpha', expect.anything())
  } finally { await act(async () => renderer.unmount()) }
})

test('old visible-editor save cannot clear a save started in the newly loaded selection', async () => {
  const loading = deferred<ReturnType<typeof document>>()
  const oldSave = deferred<ReturnType<typeof document>>()
  const currentSave = deferred<ReturnType<typeof document>>()
  const api = apiWith({ getCopilotProfile: vi.fn().mockImplementation(id => id === 'Beta' ? loading.promise : Promise.resolve(document(id))), updateCopilotProfile: vi.fn().mockImplementation(id => id === 'Alpha' ? oldSave.promise : currentSave.promise) })
  const renderer = await mount(api)
  try {
    await act(async () => click(renderer, 'Alpha'))
    act(() => click(renderer, 'Beta'))
    act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
    await act(async () => loading.resolve(document('Beta')))
    act(() => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
    await act(async () => oldSave.resolve(document('Alpha')))
    expect(renderer.root.findAllByType('button').some(button => button.props['aria-busy'])).toBe(true)
    await act(async () => currentSave.resolve(document('Beta')))
    expect(name(renderer)).toBe('Beta')
    expect(api.updateCopilotProfile).toHaveBeenCalledTimes(2)
  } finally { await act(async () => renderer.unmount()) }
})
