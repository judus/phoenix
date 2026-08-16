import { createEmptyRuntimeState } from '@phoenix/contracts'
import { describe, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import {
  BrowserPhoenixEventHub,
  type PhoenixBrowserEventSource
} from '../apps/web/src/platform/events/browser-phoenix-event-hub.js'

describe('BrowserPhoenixEventHub', () => {
  test('owns one stream and distributes validated typed events', () => {
    const source = new FakeEventSource()
    const factory = vi.fn(() => source)
    const hub = new BrowserPhoenixEventHub(apiStub(), factory)
    const states: string[] = []
    const revisions: number[] = []
    hub.subscribeConnection(() => states.push(hub.getConnectionSnapshot().state))
    hub.subscribe('runtime-state', state => revisions.push(state.revision))

    hub.start()
    hub.start()
    source.open()
    source.emit('runtime-state', { ...createEmptyRuntimeState(), revision: 4 })

    expect(factory).toHaveBeenCalledTimes(1)
    expect(factory).toHaveBeenCalledWith('/api/events?conversationId=phoenix-copilot')
    expect(states).toEqual(['connecting', 'open'])
    expect(revisions).toEqual([4])

    hub.stop()
    expect(source.closed).toBe(true)
    expect(hub.getConnectionSnapshot()).toEqual({ state: 'idle' })
  })

  test('keeps invalid event evidence without publishing it', () => {
    const source = new FakeEventSource()
    const hub = new BrowserPhoenixEventHub(apiStub(), () => source)
    const listener = vi.fn()
    hub.subscribe('runtime-state', listener)
    hub.start()

    source.emitSerialized('runtime-state', '{"revision":"invalid"}')

    expect(listener).not.toHaveBeenCalled()
    expect(hub.getConnectionSnapshot()).toMatchObject({ state: 'error' })
  })

  test('captures connection construction failures as evidence', () => {
    const hub = new BrowserPhoenixEventHub(apiStub(), () => { throw new Error('EventSource unavailable.') })
    expect(() => hub.start()).not.toThrow()
    expect(hub.getConnectionSnapshot()).toEqual({
      state: 'error',
      error: 'EventSource unavailable.'
    })
  })
})

class FakeEventSource implements PhoenixBrowserEventSource {
  onerror: ((event: Event) => void) | null = null
  onopen: ((event: Event) => void) | null = null
  closed = false
  readonly #listeners = new Map<string, Set<EventListener>>()

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.#listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(type, listeners)
  }

  close(): void {
    this.closed = true
  }

  open(): void {
    this.onopen?.(new Event('open'))
  }

  emit(type: string, payload: unknown): void {
    this.emitSerialized(type, JSON.stringify(payload))
  }

  emitSerialized(type: string, data: string): void {
    const event = new MessageEvent(type, { data })
    for (const listener of this.#listeners.get(type) ?? []) listener(event)
  }
}

function apiStub(): PhoenixApi {
  return {
    async claimPairing() { throw new Error('Not used.') },
    eventStreamUrl() { return '/api/events?conversationId=phoenix-copilot' },
    async getHealth() { throw new Error('Not used.') },
    async getPairingStatus() { throw new Error('Not used.') },
    async getRuntimeState() { throw new Error('Not used.') }
  }
}
