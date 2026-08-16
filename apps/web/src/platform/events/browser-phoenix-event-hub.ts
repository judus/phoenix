import {
  ActivityLogEntrySchema,
  CommandCatalogueRevisionSchema,
  CopilotConversationEventSchema,
  CopilotProfilesResponseSchema,
  CopilotVoiceHostCommandSchema,
  CopilotVoiceHostSnapshotSchema,
  DisplayCommandSchema,
  NavigationRouteSchema,
  RuntimeStateSchema
} from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type {
  PhoenixEventConnectionSnapshot,
  PhoenixEventHub,
  PhoenixEventMap,
  PhoenixEventName
} from '../../application/events/phoenix-event-hub.js'

const EVENT_NAMES: readonly PhoenixEventName[] = [
  'activity-entry',
  'command-catalogue',
  'conversation-event',
  'copilot-profiles',
  'display-command',
  'navigation-route',
  'runtime-state',
  'voice-host',
  'voice-host-command'
]

const EVENT_SCHEMAS: Record<PhoenixEventName, { parse(value: unknown): unknown }> = {
  'activity-entry': ActivityLogEntrySchema,
  'command-catalogue': CommandCatalogueRevisionSchema,
  'conversation-event': CopilotConversationEventSchema,
  'copilot-profiles': CopilotProfilesResponseSchema,
  'display-command': DisplayCommandSchema,
  'navigation-route': NavigationRouteSchema,
  'runtime-state': RuntimeStateSchema,
  'voice-host': CopilotVoiceHostSnapshotSchema,
  'voice-host-command': CopilotVoiceHostCommandSchema
}

export interface PhoenixBrowserEventSource {
  onerror: ((event: Event) => void) | null
  onopen: ((event: Event) => void) | null
  addEventListener(type: string, listener: EventListener): void
  close(): void
}

export type PhoenixEventSourceFactory = (url: string) => PhoenixBrowserEventSource

export class BrowserPhoenixEventHub implements PhoenixEventHub {
  readonly #api: PhoenixApi
  readonly #createEventSource: PhoenixEventSourceFactory
  readonly #listeners = new Map<PhoenixEventName, Set<(payload: unknown) => void>>()
  readonly #connectionListeners = new Set<() => void>()
  #source: PhoenixBrowserEventSource | undefined
  #connection: PhoenixEventConnectionSnapshot = { state: 'idle' }

  constructor(api: PhoenixApi, createEventSource: PhoenixEventSourceFactory) {
    this.#api = api
    this.#createEventSource = createEventSource
  }

  getConnectionSnapshot = (): PhoenixEventConnectionSnapshot => this.#connection

  start(): void {
    if (this.#source) return
    this.#setConnection({ state: 'connecting' })
    let source: PhoenixBrowserEventSource
    try {
      source = this.#createEventSource(this.#api.eventStreamUrl())
    } catch (cause) {
      this.#setConnection({
        state: 'error',
        error: cause instanceof Error ? cause.message : 'PHOENIX event stream unavailable.'
      })
      return
    }
    this.#source = source
    source.onopen = () => this.#setConnection({ state: 'open' })
    source.onerror = () => this.#setConnection({
      state: 'error',
      error: 'PHOENIX event stream connection lost; reconnecting.'
    })
    for (const eventName of EVENT_NAMES) {
      source.addEventListener(eventName, event => this.#receive(eventName, event))
    }
  }

  stop(): void {
    this.#source?.close()
    this.#source = undefined
    this.#setConnection({ state: 'idle' })
  }

  subscribe<K extends PhoenixEventName>(
    eventName: K,
    listener: (payload: PhoenixEventMap[K]) => void
  ): () => void {
    const wrapped = (payload: unknown): void => listener(payload as PhoenixEventMap[K])
    const listeners = this.#listeners.get(eventName) ?? new Set()
    listeners.add(wrapped)
    this.#listeners.set(eventName, listeners)
    return () => {
      listeners.delete(wrapped)
      if (listeners.size === 0) this.#listeners.delete(eventName)
    }
  }

  subscribeConnection = (listener: () => void): (() => void) => {
    this.#connectionListeners.add(listener)
    return () => this.#connectionListeners.delete(listener)
  }

  #receive(eventName: PhoenixEventName, event: Event): void {
    try {
      if (!(event instanceof MessageEvent) || typeof event.data !== 'string') {
        throw new Error(`Invalid ${eventName} event envelope.`)
      }
      const payload = EVENT_SCHEMAS[eventName].parse(JSON.parse(event.data))
      for (const listener of this.#listeners.get(eventName) ?? []) listener(payload)
    } catch (cause) {
      this.#setConnection({
        state: 'error',
        error: cause instanceof Error ? cause.message : `Invalid ${eventName} event.`
      })
    }
  }

  #setConnection(connection: PhoenixEventConnectionSnapshot): void {
    if (connection.state === this.#connection.state && connection.error === this.#connection.error) return
    this.#connection = connection
    for (const listener of this.#connectionListeners) listener()
  }
}
