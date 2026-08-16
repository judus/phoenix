import { createEmptyRuntimeState } from '@phoenix/contracts'
import { expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type {
  PhoenixEventHub,
  PhoenixEventMap,
  PhoenixEventName
} from '../apps/web/src/application/events/phoenix-event-hub.js'
import { RuntimeStateStore } from '../apps/web/src/application/runtime/runtime-state-store.js'

test('live runtime evidence cannot be overwritten by a stale initial request', async () => {
  let resolveInitial: ((state: ReturnType<typeof createEmptyRuntimeState>) => void) | undefined
  const api = apiStub(new Promise(resolve => { resolveInitial = resolve }))
  const events = new FakeEventHub()
  const store = new RuntimeStateStore(api, events)
  const listener = vi.fn()
  store.subscribe(listener)

  store.start()
  events.emit('runtime-state', { ...createEmptyRuntimeState(), revision: 2 })
  resolveInitial?.({ ...createEmptyRuntimeState(), revision: 1 })
  await Promise.resolve()

  expect(store.getSnapshot()).toMatchObject({ status: 'ready', state: { revision: 2 } })
  expect(listener).toHaveBeenCalled()

  store.stop()
  expect(store.getSnapshot()).toEqual({ status: 'idle' })
})

test('a stopped store ignores a request that resolves after cancellation', async () => {
  let resolveInitial: ((state: ReturnType<typeof createEmptyRuntimeState>) => void) | undefined
  const store = new RuntimeStateStore(
    apiStub(new Promise(resolve => { resolveInitial = resolve })),
    new FakeEventHub()
  )

  store.start()
  store.stop()
  resolveInitial?.({ ...createEmptyRuntimeState(), revision: 3 })
  await Promise.resolve()

  expect(store.getSnapshot()).toEqual({ status: 'idle' })
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

function apiStub(runtime: Promise<ReturnType<typeof createEmptyRuntimeState>>): PhoenixApi {
  return {
    async claimPairing() { throw new Error('Not used.') },
    eventStreamUrl() { return '/api/events' },
    async getHealth() { throw new Error('Not used.') },
    async getPairingStatus() { throw new Error('Not used.') },
    async getRuntimeState() { return runtime }
  }
}
