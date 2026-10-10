import { renderToStaticMarkup } from 'react-dom/server'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../apps/web/src/application/events/phoenix-event-hub.js'
import type { ClientIdentity } from '../apps/web/src/application/identity/client-identity.js'
import type { DevicePreferences } from '../apps/web/src/application/settings/device-preferences.js'
import { CopilotPage } from '../apps/web/src/features/copilot/copilot-page.js'
import { CopilotVoiceProvider } from '../apps/web/src/features/copilot/copilot-voice-provider.js'
import { CopilotTextProvider } from '../apps/web/src/features/copilot/copilot-text-provider.js'

const api = {
  async getCopilotProfiles() { return { activeProfileId: 'marin', profiles: [{ description: 'Shipboard companion.', id: 'marin', mark: 'M', name: 'Marin', voice: 'marin' }] } },
  async getCopilotVoiceHost() { return { desiredConnected: false, desiredRevision: 0, host: null } }
} as PhoenixApi
const events = { subscribe: () => () => undefined } as unknown as PhoenixEventHub
const identity = { forScope: () => 'copilot-test-client' } as ClientIdentity
const deviceSnapshot = { version: 2, audioInputId: '', audioOutputId: '', captureNumpad: true, currentShipLoadoutView: 'tiles', galaxyQueryResultsView: 'table', followCopilotNavigation: true, presentation: 'phoenix', showDeveloper: true, showNumpadButton: false, shipCatalogueView: 'dossier', uiScalePercent: 100, variableCommandLabelSizes: true } as const
const devicePreferences = {
  getSnapshot: () => deviceSnapshot,
  subscribe: () => () => undefined,
  update: () => undefined
} as DevicePreferences

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

test.each(['success', 'failure'] as const)('composer keeps the next draft through response %s and focuses only on send', async outcome => {
  let resolve!: () => void
  let reject!: (cause: Error) => void
  const response = new Promise<void>((accept, fail) => { resolve = accept; reject = fail })
  const stream = vi.fn(() => response)
  const chatApi: PhoenixApi = { ...api,
    getCopilotHistory: async () => ({ conversationId: 'phoenix-copilot', messages: [] }), streamCopilotMessage: stream }
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(<CopilotVoiceProvider api={chatApi} clientIdentity={identity} devicePreferences={devicePreferences} events={events}>
      <CopilotTextProvider api={chatApi} clientIdentity={identity} events={events}><CopilotPage api={chatApi} view="chat" /></CopilotTextProvider>
    </CopilotVoiceProvider>)
  })
  const focus = vi.fn()
  const submission = { preventDefault: vi.fn(), currentTarget: { querySelector: () => ({ focus }) } }
  const textarea = () => renderer.root.findByType('textarea')
  const form = () => renderer.root.findByType('form')
  try {
    await act(async () => textarea().props.onChange({ target: { value: 'First message' } }))
    await act(async () => form().props.onSubmit(submission))
    expect(stream).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledTimes(1)
    expect(textarea().props.disabled).not.toBe(true)
    expect(textarea().props.readOnly).not.toBe(true)
    await act(async () => textarea().props.onChange({ target: { value: 'Next draft' } }))
    await act(async () => form().props.onSubmit(submission))
    expect(textarea().props.value).toBe('Next draft')
    expect(stream).toHaveBeenCalledTimes(1)
    expect(focus).toHaveBeenCalledTimes(1)
    await act(async () => {
      if (outcome === 'success') resolve()
      else reject(new Error('Synthetic response failure'))
    })
    expect(textarea().props.value).toBe('Next draft')
    expect(focus).toHaveBeenCalledTimes(1)
    expect(renderer.root.findByProps({ 'aria-label': 'Send, ENTER' }).props.disabled).not.toBe(true)
  } finally { await act(async () => renderer.unmount()) }
})

test('Copilot chat is conversation-first and exposes compact voice control', () => {
  const markup = renderToStaticMarkup(<CopilotVoiceProvider api={api} clientIdentity={identity} devicePreferences={devicePreferences} events={events}><CopilotTextProvider api={api} clientIdentity={identity} events={events}><CopilotPage api={api} view="chat" /></CopilotTextProvider></CopilotVoiceProvider>)

  expect(markup).toContain('aria-label="Active Copilot profile"')
  expect(markup).not.toContain('<h1>Copilot</h1>')
  expect(markup).toContain('<strong>MARIN</strong>')
  expect(markup).toContain('Message Copilot')
  expect(markup).toContain('Connect voice')
  expect(markup).not.toContain('Custom shortcuts')
})

test('Copilot profiles reserve the protected character editor surface', () => {
  const markup = renderToStaticMarkup(<CopilotVoiceProvider api={api} clientIdentity={identity} devicePreferences={devicePreferences} events={events}><CopilotTextProvider api={api} clientIdentity={identity} events={events}><CopilotPage api={api} view="profiles" /></CopilotTextProvider></CopilotVoiceProvider>)

  expect(markup).toContain('<h1>Profiles</h1>')
  expect(markup).toContain('New profile')
  expect(markup).toContain('Select a profile')
})
