import type { PhoenixApi } from '../application/api/phoenix-api.js'
import type { DevicePreferences } from '../application/settings/device-preferences.js'
import type { PhoenixEventHub } from '../application/events/phoenix-event-hub.js'
import type { ClientIdentity } from '../application/identity/client-identity.js'
import type { PhoenixRouter } from '../application/navigation/phoenix-router.js'
import { RouterNumpadRouteSession, type NumpadRouteSession } from '../application/navigation/numpad-route-session.js'
import { RuntimeStateStore } from '../application/runtime/runtime-state-store.js'
import { PhoenixApiClient } from '../platform/api/phoenix-api-client.js'
import {
  BrowserPhoenixEventHub,
  type PhoenixEventSourceFactory
} from '../platform/events/browser-phoenix-event-hub.js'
import { BrowserPhoenixRouter } from '../platform/routing/browser-phoenix-router.js'
import { BrowserDevicePreferences } from '../platform/storage/browser-device-preferences.js'
import { BrowserClientIdentity } from '../platform/storage/browser-client-identity.js'
import { GalaxyQuerySessionStore } from '../features/galaxy/galaxy-query-session-store.js'
import { NumpadRuntime } from '../features/numpad/numpad-runtime.js'

export interface PhoenixApplicationServices {
  initialPairingCode?: string
  requirePairing?: () => void
  api: PhoenixApi
  clientIdentity: ClientIdentity
  devicePreferences: DevicePreferences
  events: PhoenixEventHub
  galaxyQueries: GalaxyQuerySessionStore
  numpadRouteSession: NumpadRouteSession
  numpad: NumpadRuntime
  router: PhoenixRouter
  runtime: RuntimeStateStore
}

export interface CreatePhoenixApplicationOptions {
  baseUrl?: string
  createEventSource?: PhoenixEventSourceFactory
  request?: typeof fetch
}

export function createPhoenixApplication(
  browserWindow: Window,
  options: CreatePhoenixApplicationOptions = {}
): PhoenixApplicationServices {
  // Capture the QR fragment before the router canonicalizes the initial URL.
  const initialPairingCode = new URLSearchParams(browserWindow.location.hash.slice(1)).get('pair') ?? ''
  let redirectingToPairing = false
  const requirePairing = (): void => {
    if (redirectingToPairing) return
    redirectingToPairing = true
    // Full navigation discards stale application state/streams. The APK intercepts this
    // same-origin path and opens its native card; browsers reload into PairingGate.
    browserWindow.location.replace('/pairing')
  }
  const api = new PhoenixApiClient(options.baseUrl, options.request, requirePairing)
  const createEventSource = options.createEventSource ?? (url => new EventSource(url))
  const events = new BrowserPhoenixEventHub(api, createEventSource)
  let localStorage: Storage
  let sessionStorage: Storage
  try {
    localStorage = browserWindow.localStorage
  } catch {
    localStorage = unavailableStorage()
  }
  try {
    sessionStorage = browserWindow.sessionStorage
  } catch {
    sessionStorage = unavailableStorage()
  }
  const router = new BrowserPhoenixRouter(browserWindow)
  const numpadRouteSession = new RouterNumpadRouteSession(router, sessionStorage)
  return {
    initialPairingCode,
    requirePairing,
    api,
    clientIdentity: new BrowserClientIdentity(sessionStorage),
    devicePreferences: new BrowserDevicePreferences(localStorage),
    events,
    galaxyQueries: new GalaxyQuerySessionStore(),
    numpadRouteSession,
    numpad: new NumpadRuntime(api, events, router, numpadRouteSession),
    router,
    runtime: new RuntimeStateStore(api, events)
  }
}

function unavailableStorage(): Storage {
  return {
    length: 0,
    clear() {},
    getItem() { return null },
    key() { return null },
    removeItem() {},
    setItem() {}
  }
}
