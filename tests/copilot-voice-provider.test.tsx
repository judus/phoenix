import { act, create } from 'react-test-renderer'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { DevicePreferences, PhoenixDevicePreferencesSnapshot } from '../apps/web/src/application/settings/device-preferences.js'
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

afterEach(() => vi.unstubAllGlobals())

test('local disconnect cancels an in-progress microphone connection and acknowledges off intent', async () => {
  const events = new FakeEventHub()
  const mediaRequest = deferred<MediaStream>()
  const stop = vi.fn()
  const getUserMedia = vi.fn().mockReturnValue(mediaRequest.promise)
  const requestCopilotVoiceHostState = vi.fn().mockResolvedValue({
    accepted: true,
    command: {
      desiredConnected: false,
      hostId: 'desktop-client',
      issuedAt: '2026-08-19T12:00:01.000Z',
      requestId: 'request-off',
      revision: 1
    }
  })
  const webSocket = vi.fn()
  vi.stubGlobal('window', { isSecureContext: true })
  vi.stubGlobal('navigator', {
    mediaDevices: {
      enumerateDevices: vi.fn().mockResolvedValue([]),
      getUserMedia
    }
  })
  vi.stubGlobal('WebSocket', webSocket)

  const api = {
    createCopilotRealtimeToken: vi.fn().mockResolvedValue({ model: 'realtime-test', value: 'token' }),
    getCopilotAudioProcessing: vi.fn().mockResolvedValue({}),
    getCopilotProfiles: vi.fn().mockResolvedValue({
      activeProfileId: 'marin',
      profiles: [{ description: '', id: 'marin', mark: 'M', name: 'Marin', voice: 'marin' }]
    }),
    getCopilotVoiceHost: vi.fn().mockResolvedValue({ desiredConnected: false, desiredRevision: 0, host: null }),
    releaseCopilotVoiceHost: vi.fn().mockResolvedValue(undefined),
    requestCopilotVoiceHostState,
    updateCopilotVoiceHost: vi.fn().mockImplementation(async input => ({
      desiredConnected: input.connected,
      desiredRevision: input.appliedRevision,
      host: { ...input, lastSeenAt: '2026-08-19T12:00:00.000Z' }
    }))
  } as unknown as PhoenixApi
  let voice: CopilotVoiceState | undefined

  function Probe() { voice = useCopilotVoice(); return null }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(
    <CopilotVoiceProvider api={api} clientIdentity={{ forScope: () => 'desktop-client' }} devicePreferences={new FakeDevicePreferences()} events={events}>
      <Probe />
    </CopilotVoiceProvider>
  ) })

  let connection!: Promise<void>
  await act(async () => {
    connection = voice!.connect()
    await Promise.resolve()
    await Promise.resolve()
  })
  expect(getUserMedia).toHaveBeenCalledOnce()

  await act(async () => voice!.disconnect())
  expect(requestCopilotVoiceHostState).toHaveBeenCalledWith(false)
  expect(voice?.status).toBe('Offline')

  await act(async () => {
    mediaRequest.resolve({ getTracks: () => [{ stop }] } as unknown as MediaStream)
    await connection
  })
  expect(stop).toHaveBeenCalledOnce()
  expect(webSocket).not.toHaveBeenCalled()
  expect(voice?.connected).toBe(false)
  expect(requestCopilotVoiceHostState.mock.calls).toEqual([[false]])

  await act(async () => renderer.unmount())
})

test('voice lifecycle observes the shared event hub and controls a remote host through the shared API', async () => {
  const events = new FakeEventHub()
  const requestCopilotVoiceHostState = vi.fn().mockResolvedValue({
    command: {
      desiredConnected: true,
      hostId: 'desktop-host',
      issuedAt: '2026-08-16T12:00:01.000Z',
      requestId: 'request-1',
      revision: 1
    },
    snapshot: { desiredConnected: true, desiredRevision: 1, host: null }
  })
  const api = {
    getCopilotProfiles: vi.fn().mockResolvedValue({
      activeProfileId: 'marin',
      profiles: [{ description: '', id: 'marin', mark: 'M', name: 'Marin', voice: 'marin' }]
    }),
    getCopilotVoiceHost: vi.fn().mockResolvedValue({ desiredConnected: false, desiredRevision: 0, host: null }),
    requestCopilotVoiceHostState
  } as unknown as PhoenixApi
  let voice: CopilotVoiceState | undefined

  function Probe() {
    voice = useCopilotVoice()
    return null
  }

  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(
    <CopilotVoiceProvider
      api={api}
      clientIdentity={{ forScope: () => 'tablet-client' }}
      devicePreferences={new FakeDevicePreferences()}
      events={events}
    >
      <Probe />
    </CopilotVoiceProvider>
  ) })

  await act(async () => events.emit('voice-host', {
    desiredConnected: false,
    desiredRevision: 0,
    host: {
      appliedRevision: 0,
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
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(
    <CopilotVoiceProvider api={api} clientIdentity={{ forScope: () => 'tablet-client' }} devicePreferences={new FakeDevicePreferences()} events={events}>
      <Probe />
    </CopilotVoiceProvider>
  ) })

  await act(async () => {
    events.emit('copilot-profiles', {
      activeProfileId: 'live',
      profiles: [{ description: 'Live', id: 'live', mark: 'L', name: 'Live', voice: 'marin' }]
    })
    events.emit('voice-host', {
      desiredConnected: false,
      desiredRevision: 0,
      host: { appliedRevision: 0, armed: true, clientId: 'live-host', connected: false, hostId: 'live-host', lastSeenAt: '2026-08-17T12:00:00.000Z', phase: 'ready' }
    })
    profilesRequest.resolve({
      activeProfileId: 'stale',
      profiles: [{ description: 'Stale', id: 'stale', mark: 'S', name: 'Stale', voice: 'marin' }]
    })
    hostRequest.resolve({ desiredConnected: false, desiredRevision: 0, host: null })
    await Promise.resolve()
  })

  expect(voice?.activeProfile.id).toBe('live')
  expect(voice?.hostLocation).toBe('remote')
  await act(async () => renderer.unmount())
})

test('voice audio selection follows the device preference owner', async () => {
  const events = new FakeEventHub()
  const preferences = new FakeDevicePreferences()
  const api = {
    getCopilotProfiles: vi.fn().mockResolvedValue({
      activeProfileId: 'marin',
      profiles: [{ description: '', id: 'marin', mark: 'M', name: 'Marin', voice: 'marin' }]
    }),
    getCopilotVoiceHost: vi.fn().mockResolvedValue({ desiredConnected: false, desiredRevision: 0, host: null })
  } as unknown as PhoenixApi
  let voice: CopilotVoiceState | undefined

  function Probe() { voice = useCopilotVoice(); return null }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(
    <CopilotVoiceProvider api={api} clientIdentity={{ forScope: () => 'tablet-client' }} devicePreferences={preferences} events={events}>
      <Probe />
    </CopilotVoiceProvider>
  ) })

  await act(async () => preferences.update({ audioInputId: 'mic-1', audioOutputId: 'speaker-1' }))
  expect(voice?.inputId).toBe('mic-1')
  expect(voice?.outputId).toBe('speaker-1')

  await act(async () => voice?.setInputId('mic-2'))
  expect(preferences.getSnapshot().audioInputId).toBe('mic-2')
  expect(voice?.inputId).toBe('mic-2')
  await act(async () => renderer.unmount())
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(accept => { resolve = accept })
  return { promise, resolve }
}

function baseApi(patch: Partial<PhoenixApi> = {}): PhoenixApi {
  return {
    requestCopilotVoiceHostState: vi.fn().mockResolvedValue({ accepted: true, command: { revision: 1, desiredConnected: true, hostId: 'desktop-client', issuedAt: '2026-10-04T12:00:00Z', requestId: 'test' } }),
    getCopilotProfiles: vi.fn().mockResolvedValue({ activeProfileId: 'marin', profiles: [{ description: '', id: 'marin', mark: 'M', name: 'Marin', voice: 'marin' }] }),
    getCopilotVoiceHost: vi.fn().mockResolvedValue({ desiredConnected: false, desiredRevision: 0, host: null }),
    updateCopilotVoiceHost: vi.fn().mockImplementation(async input => ({ desiredConnected: false, desiredRevision: 0, host: { ...input, lastSeenAt: '2026-10-04T12:00:00Z' } })),
    releaseCopilotVoiceHost: vi.fn().mockResolvedValue(undefined),
    createCopilotRealtimeToken: vi.fn().mockResolvedValue({ model: 'test', value: 'token' }),
    getCopilotAudioProcessing: vi.fn().mockResolvedValue({}),
    ...patch
  } as unknown as PhoenixApi
}

test('disposed local host does not reconcile a delayed heartbeat into a new connection', async () => {
  const heartbeat = deferred<Awaited<ReturnType<PhoenixApi['updateCopilotVoiceHost']>>>()
  const api = baseApi({ updateCopilotVoiceHost: vi.fn().mockReturnValue(heartbeat.promise) })
  vi.stubGlobal('window', { isSecureContext: true })
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }), enumerateDevices: vi.fn().mockResolvedValue([]) } })
  vi.stubGlobal('WebSocket', class { close = vi.fn() })
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<CopilotVoiceProvider api={api} clientIdentity={{ forScope: () => 'desktop-client' }} devicePreferences={new FakeDevicePreferences()} events={new FakeEventHub()}>{null}</CopilotVoiceProvider>) })
  await act(async () => renderer.unmount())
  await act(async () => heartbeat.resolve({ desiredConnected: true, desiredRevision: 1, host: { appliedRevision: 0, armed: true, clientId: 'desktop-client', connected: false, hostId: 'desktop-client', lastSeenAt: '2026-10-04T12:00:00Z', phase: 'ready' } }))
  expect(api.releaseCopilotVoiceHost).toHaveBeenCalledOnce()
  expect(api.createCopilotRealtimeToken).not.toHaveBeenCalled()
})

test('API replacement cancels an old token attempt before it opens the microphone', async () => {
  const token = deferred<Awaited<ReturnType<PhoenixApi['createCopilotRealtimeToken']>>>()
  const old = baseApi({ createCopilotRealtimeToken: vi.fn().mockReturnValue(token.promise) })
  const current = baseApi()
  const events = new FakeEventHub()
  const preferences = new FakeDevicePreferences()
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [] })
  vi.stubGlobal('window', { isSecureContext: true })
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) } })
  vi.stubGlobal('WebSocket', class { close = vi.fn() })
  let voice!: CopilotVoiceState
  function Probe() { voice = useCopilotVoice(); return null }
  const page = (api: PhoenixApi) => <CopilotVoiceProvider api={api} clientIdentity={{ forScope: () => 'desktop-client' }} devicePreferences={preferences} events={events}><Probe /></CopilotVoiceProvider>
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(page(old)) })
  try {
    let connect!: Promise<void>
    act(() => { connect = voice.connect() })
    await act(async () => renderer.update(page(current)))
    await act(async () => { token.resolve({ model: 'test', value: 'token' }); await connect })
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(current.requestCopilotVoiceHostState).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})

test('profile selection response cannot overwrite a newer live profile event', async () => {
  const selection = deferred<Awaited<ReturnType<PhoenixApi['selectCopilotProfile']>>>()
  const api = baseApi({ selectCopilotProfile: vi.fn().mockReturnValue(selection.promise) })
  const events = new FakeEventHub()
  let voice!: CopilotVoiceState
  function Probe() { voice = useCopilotVoice(); return null }
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<CopilotVoiceProvider api={api} clientIdentity={{ forScope: () => 'tablet-client' }} devicePreferences={new FakeDevicePreferences()} events={events}><Probe /></CopilotVoiceProvider>) })
  try {
    let select!: Promise<void>
    act(() => { select = voice.selectProfile('operator') })
    await act(async () => events.emit('copilot-profiles', { activeProfileId: 'live', profiles: [{ id: 'live', name: 'Live', mark: 'L', description: '', voice: 'marin' }] }))
    await act(async () => { selection.resolve({ activeProfileId: 'operator', profiles: [{ id: 'operator', name: 'Operator', mark: 'O', description: '', voice: 'marin' }] }); await select })
    expect(voice.activeProfile.id).toBe('live')
  } finally { await act(async () => renderer.unmount()) }
})

test.each(['unmount', 'replace'] as const)('retained connection controls cannot act after %s', async change => {
  const old = baseApi()
  const current = baseApi()
  const events = new FakeEventHub()
  const preferences = new FakeDevicePreferences()
  vi.stubGlobal('window', { isSecureContext: true })
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }), enumerateDevices: vi.fn().mockResolvedValue([]) } })
  vi.stubGlobal('WebSocket', class { close = vi.fn() })
  let voice!: CopilotVoiceState
  function Probe() { voice = useCopilotVoice(); return null }
  const page = (api: PhoenixApi) => <CopilotVoiceProvider api={api} clientIdentity={{ forScope: () => 'desktop-client' }} devicePreferences={preferences} events={events}><Probe /></CopilotVoiceProvider>
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(page(old)) })
  const retained = voice
  try {
    if (change === 'unmount') await act(async () => renderer.unmount())
    else await act(async () => renderer.update(page(current)))
    await act(async () => retained.connect())
    act(() => retained.disconnect())
    expect(old.createCopilotRealtimeToken).not.toHaveBeenCalled()
    expect(old.requestCopilotVoiceHostState).not.toHaveBeenCalled()
  } finally { if (change !== 'unmount') await act(async () => renderer.unmount()) }
})

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

class FakeDevicePreferences implements DevicePreferences {
  readonly #listeners = new Set<() => void>()
  #snapshot: PhoenixDevicePreferencesSnapshot = {
    audioInputId: '',
    audioOutputId: '',
    captureNumpad: true,
    currentShipLoadoutView: 'tiles',
    followCopilotNavigation: true,
    shipCatalogueView: 'dossier',
    presentation: 'phoenix',
    uiScalePercent: 100,
    variableCommandLabelSizes: true,
    version: 2
  }

  getSnapshot = (): PhoenixDevicePreferencesSnapshot => this.#snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }
  update(patch: Partial<PhoenixDevicePreferencesSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...patch }
    for (const listener of this.#listeners) listener()
  }
}
