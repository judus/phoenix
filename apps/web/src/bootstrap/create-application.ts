import type { PhoenixApi } from '../application/api/phoenix-api.js'
import type { DisplayCommandPreference } from '../application/display/display-command-preference.js'
import type { PhoenixEventHub } from '../application/events/phoenix-event-hub.js'
import type { PhoenixRouter } from '../application/navigation/phoenix-router.js'
import { RuntimeStateStore } from '../application/runtime/runtime-state-store.js'
import { PhoenixApiClient } from '../platform/api/phoenix-api-client.js'
import {
  BrowserPhoenixEventHub,
  type PhoenixEventSourceFactory
} from '../platform/events/browser-phoenix-event-hub.js'
import { BrowserPhoenixRouter } from '../platform/routing/browser-phoenix-router.js'
import { BrowserDisplayCommandPreference } from '../platform/storage/browser-display-command-preference.js'

export interface PhoenixApplicationServices {
  api: PhoenixApi
  displayCommands: DisplayCommandPreference
  events: PhoenixEventHub
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
  try {
    localStorage = browserWindow.localStorage
  } catch {
    localStorage = unavailableStorage()
  }
  return {
    api,
    displayCommands: new BrowserDisplayCommandPreference(localStorage),
    events,
    router: new BrowserPhoenixRouter(browserWindow),
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
