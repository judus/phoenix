import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type {
  PhoenixEventHub,
  PhoenixEventMap,
  PhoenixEventName
} from '../apps/web/src/application/events/phoenix-event-hub.js'
import type { RuntimeStateStore } from '../apps/web/src/application/runtime/runtime-state-store.js'
import type { PhoenixApplicationServices } from '../apps/web/src/bootstrap/create-application.js'
import { PhoenixProviders } from '../apps/web/src/bootstrap/providers.js'
import { BrowserPhoenixRouter } from '../apps/web/src/platform/routing/browser-phoenix-router.js'
import { BrowserDevicePreferences } from '../apps/web/src/platform/storage/browser-device-preferences.js'

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

test('providers start global services and route allowed display commands through typed fields', async () => {
  const browser = new FakeBrowserWindow('#/')
  const events = new FakeEventHub()
  const runtime = {
    start: vi.fn(),
    stop: vi.fn()
  } as unknown as RuntimeStateStore
  const devicePreferences = new BrowserDevicePreferences(browser.localStorage)
  const application: PhoenixApplicationServices = {
    api: apiStub(),
    clientIdentity: { forScope: scope => `${scope}-client` },
    devicePreferences,
    events,
    numpadRouteSession: {
      acknowledge() {},
      arm() {},
      discard() {},
      isArmed: () => false,
      leave: () => false,
      navigate() {}
    },
    router: new BrowserPhoenixRouter(browser as unknown as Window),
    runtime
  }

  const renderer = await act(async () => create(
    <PhoenixProviders application={application}><span>Application</span></PhoenixProviders>
  ))
  expect(events.start).toHaveBeenCalledTimes(1)
  expect(runtime.start).toHaveBeenCalledTimes(1)

  await act(async () => events.emit('display-command', {
    id: 'display-1',
    type: 'show_body',
    systemName: 'Sol',
    selectedName: 'Earth',
    createdAt: '2026-08-16T12:00:00.000Z'
  }))
  expect(application.router.getSnapshot()).toEqual({
    kind: 'information',
    section: 'galaxy',
    view: 'system',
    systemName: 'Sol',
    selectedName: 'Earth'
  })

  devicePreferences.update({ followCopilotNavigation: false })
  await act(async () => events.emit('display-command', {
    id: 'display-2',
    type: 'show_system',
    systemName: 'Achenar',
    selectedName: null,
    createdAt: '2026-08-16T12:01:00.000Z'
  }))
  expect(application.router.href(application.router.getSnapshot())).toBe('#/galaxy/system?name=Sol&selected=Earth')

  await act(async () => renderer.unmount())
  expect(runtime.stop).toHaveBeenCalledTimes(1)
  expect(events.stop).toHaveBeenCalledTimes(1)
})

class FakeEventHub implements PhoenixEventHub {
  readonly start = vi.fn()
  readonly stop = vi.fn()
  readonly #listeners = new Map<PhoenixEventName, Set<(payload: unknown) => void>>()

  getConnectionSnapshot = () => ({ state: 'idle' as const })
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

class FakeBrowserWindow {
  readonly location: { hash: string }
  readonly localStorage = new MemoryStorage()
  readonly sessionStorage = new MemoryStorage()
  readonly history = {
    pushState: (_data: unknown, _unused: string, url?: string | URL | null) => { this.location.hash = String(url ?? '') },
    replaceState: (_data: unknown, _unused: string, url?: string | URL | null) => { this.location.hash = String(url ?? '') }
  }
  readonly #listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()

  constructor(hash: string) { this.location = { hash } }
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.#listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(type, listeners)
  }
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.#listeners.get(type)?.delete(listener)
  }
}

class MemoryStorage {
  readonly #values = new Map<string, string>()
  getItem(key: string): string | null { return this.#values.get(key) ?? null }
  setItem(key: string, value: string): void { this.#values.set(key, value) }
}

function apiStub(): PhoenixApi {
  return {
    async getCopilotProfiles() {
      return {
        activeProfileId: 'marin',
        profiles: [{ description: '', id: 'marin', mark: 'M', name: 'Marin', voice: 'marin' }]
      }
    },
    async getCopilotVoiceHost() { return { desiredConnected: false, host: null } },
    async getMacros() { return { version: 1, macros: [] } },
    async getModuleSettings() {
      return {
        numpadCommands: {
          inputAdapter: 'browser',
          presentation: 'tiles',
          alwaysConfirm: false,
          cancelAfterMs: 5000,
          shortcuts: []
        }
      }
    },
    async claimPairing() { throw new Error('Not used.') },
    eventStreamUrl() { return '/api/events' },
    async getHealth() { throw new Error('Not used.') },
    async getPairingStatus() { throw new Error('Not used.') },
    async getRuntimeState() { throw new Error('Not used.') }
  } as PhoenixApi
}
