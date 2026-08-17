import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../apps/web/src/application/events/phoenix-event-hub.js'
import type { ClientIdentity } from '../apps/web/src/application/identity/client-identity.js'
import type { DevicePreferences } from '../apps/web/src/application/settings/device-preferences.js'
import { CopilotPage } from '../apps/web/src/features/copilot/copilot-page.js'
import { CopilotVoiceProvider } from '../apps/web/src/features/copilot/copilot-voice-provider.js'

const api = {
  async getCopilotProfiles() { return { activeProfileId: 'marin', profiles: [{ description: 'Shipboard companion.', id: 'marin', mark: 'M', name: 'Marin', voice: 'marin' }] } },
  async getCopilotVoiceHost() { return { desiredConnected: false, host: null } }
} as PhoenixApi
const events = { subscribe: () => () => undefined } as unknown as PhoenixEventHub
const identity = { forScope: () => 'copilot-test-client' } as ClientIdentity
const deviceSnapshot = { audioInputId: '', audioOutputId: '', captureNumpad: true, followCopilotNavigation: true }
const devicePreferences = {
  getSnapshot: () => deviceSnapshot,
  subscribe: () => () => undefined,
  update: () => undefined
} as DevicePreferences

test('Copilot chat is conversation-first and exposes compact voice control', () => {
  const markup = renderToStaticMarkup(<CopilotVoiceProvider api={api} clientIdentity={identity} devicePreferences={devicePreferences} events={events}><CopilotPage api={api} clientIdentity={identity} events={events} view="chat" /></CopilotVoiceProvider>)

  expect(markup).toContain('aria-label="Active Copilot profile"')
  expect(markup).not.toContain('<h1>Copilot</h1>')
  expect(markup).toContain('<strong>MARIN</strong>')
  expect(markup).toContain('Message Copilot')
  expect(markup).toContain('Connect voice')
  expect(markup).not.toContain('Custom shortcuts')
})

test('Copilot profiles reserve the protected character editor surface', () => {
  const markup = renderToStaticMarkup(<CopilotVoiceProvider api={api} clientIdentity={identity} devicePreferences={devicePreferences} events={events}><CopilotPage api={api} clientIdentity={identity} events={events} view="profiles" /></CopilotVoiceProvider>)

  expect(markup).toContain('<h1>Profiles</h1>')
  expect(markup).toContain('New profile')
  expect(markup).toContain('Select a profile')
})
