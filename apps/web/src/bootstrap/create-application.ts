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

export interface PhoenixApplicationServices {
  api: PhoenixApi
  clientIdentity: ClientIdentity
  devicePreferences: DevicePreferences
  events: PhoenixEventHub
  numpadRouteSession: NumpadRouteSession
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
  const api = new PhoenixApiClient(options.baseUrl, options.request)
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
  return {
    api,
    clientIdentity: new BrowserClientIdentity(sessionStorage),
    devicePreferences: new BrowserDevicePreferences(localStorage),
    events,
    numpadRouteSession: new RouterNumpadRouteSession(router, sessionStorage),
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
