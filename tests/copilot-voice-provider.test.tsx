import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type {
  PhoenixEventHub,
  PhoenixEventMap,
  PhoenixEventName
} from '../apps/web/src/application/events/phoenix-event-hub.js'
import {
  CopilotVoiceProvider,
  useCopilotVoice,
  type CopilotVoiceState
} from '../apps/web/src/features/copilot/copilot-voice-provider.js'

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

test('voice lifecycle observes the shared event hub and controls a remote host through the shared API', async () => {
  const events = new FakeEventHub()
  const requestCopilotVoiceHostState = vi.fn().mockResolvedValue({
    command: {
      desiredConnected: true,
      hostId: 'desktop-host',
      issuedAt: '2026-08-16T12:00:01.000Z',
      requestId: 'request-1'
    },
    snapshot: { desiredConnected: true, host: null }
  })
  const api = {
    getCopilotProfiles: vi.fn().mockResolvedValue({
      activeProfileId: 'marin',
      profiles: [{ description: '', id: 'marin', mark: 'M', name: 'Marin', voice: 'marin' }]
    }),
    getCopilotVoiceHost: vi.fn().mockResolvedValue({ desiredConnected: false, host: null }),
    requestCopilotVoiceHostState
  } as unknown as PhoenixApi
  let voice: CopilotVoiceState | undefined

  function Probe() {
    voice = useCopilotVoice()
    return null
  }

  const renderer = await act(async () => create(
    <CopilotVoiceProvider
      api={api}
      clientIdentity={{ forScope: () => 'tablet-client' }}
      events={events}
    >
      <Probe />
    </CopilotVoiceProvider>
  ))

  await act(async () => events.emit('voice-host', {
    desiredConnected: false,
    host: {
      armed: true,
      clientId: 'desktop-host',
      connected: false,
      hostId: 'desktop-host',
      lastSeenAt: '2026-08-16T12:00:00.000Z',
      phase: 'ready'
    }
  }))
  expect(voice?.hostLocation).toBe('remote')
  expect(voice?.status).toBe('Desktop ready')

  await act(async () => voice?.connect())
  expect(requestCopilotVoiceHostState).toHaveBeenCalledWith(true)

  await act(async () => events.emit('copilot-profiles', {
    activeProfileId: 'operator',
    profiles: [{ description: 'Alternate', id: 'operator', mark: 'O', name: 'Operator', voice: 'marin' }]
  }))
  expect(voice?.activeProfile.id).toBe('operator')

  await act(async () => renderer.unmount())
})

test('live profile and host events cannot be overwritten by stale initial snapshots', async () => {
  const profilesRequest = deferred<Awaited<ReturnType<PhoenixApi['getCopilotProfiles']>>>()
  const hostRequest = deferred<Awaited<ReturnType<PhoenixApi['getCopilotVoiceHost']>>>()
  const events = new FakeEventHub()
  const api = {
    getCopilotProfiles: vi.fn().mockReturnValue(profilesRequest.promise),
    getCopilotVoiceHost: vi.fn().mockReturnValue(hostRequest.promise)
  } as unknown as PhoenixApi
  let voice: CopilotVoiceState | undefined

  function Probe() { voice = useCopilotVoice(); return null }
  const renderer = await act(async () => create(
    <CopilotVoiceProvider api={api} clientIdentity={{ forScope: () => 'tablet-client' }} events={events}>
      <Probe />
    </CopilotVoiceProvider>
  ))

  await act(async () => {
    events.emit('copilot-profiles', {
      activeProfileId: 'live',
      profiles: [{ description: 'Live', id: 'live', mark: 'L', name: 'Live', voice: 'marin' }]
    })
    events.emit('voice-host', {
      desiredConnected: false,
      host: { armed: true, clientId: 'live-host', connected: false, hostId: 'live-host', lastSeenAt: '2026-08-17T12:00:00.000Z', phase: 'ready' }
    })
    profilesRequest.resolve({
      activeProfileId: 'stale',
      profiles: [{ description: 'Stale', id: 'stale', mark: 'S', name: 'Stale', voice: 'marin' }]
    })
    hostRequest.resolve({ desiredConnected: false, host: null })
    await Promise.resolve()
  })

  expect(voice?.activeProfile.id).toBe('live')
  expect(voice?.hostLocation).toBe('remote')
  await act(async () => renderer.unmount())
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(accept => { resolve = accept })
  return { promise, resolve }
}

class FakeEventHub implements PhoenixEventHub {
  readonly #listeners = new Map<PhoenixEventName, Set<(payload: unknown) => void>>()

  getConnectionSnapshot = () => ({ state: 'idle' as const })
  start(): void {}
  stop(): void {}
  subscribeConnection(): () => void { return () => undefined }

  subscribe<K extends PhoenixEventName>(
    eventName: K,
    listener: (payload: PhoenixEventMap[K]) => void
  ): () => void {
    const wrapped = (payload: unknown): void => listener(payload as PhoenixEventMap[K])
    const listeners = this.#listeners.get(eventName) ?? new Set()
    listeners.add(wrapped)
    this.#listeners.set(eventName, listeners)
    return () => listeners.delete(wrapped)
  }

  emit<K extends PhoenixEventName>(eventName: K, payload: PhoenixEventMap[K]): void {
    for (const listener of this.#listeners.get(eventName) ?? []) listener(payload)
  }
}
