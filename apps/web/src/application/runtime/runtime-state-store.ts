import type { RuntimeState } from '@phoenix/contracts'
import type { PhoenixApi } from '../api/phoenix-api.js'
import type { PhoenixEventHub } from '../events/phoenix-event-hub.js'

export type RuntimeStateSnapshot =
  | { status: 'idle' | 'loading' }
  | { status: 'ready', state: RuntimeState }
  | { status: 'error', error: string }

export class RuntimeStateStore {
  readonly #api: PhoenixApi
  readonly #events: PhoenixEventHub
  readonly #listeners = new Set<() => void>()
  #snapshot: RuntimeStateSnapshot = { status: 'idle' }
  #abort: AbortController | undefined
  #unsubscribeRuntime: (() => void) | undefined

  constructor(api: PhoenixApi, events: PhoenixEventHub) {
    this.#api = api
    this.#events = events
  }

  getSnapshot = (): RuntimeStateSnapshot => this.#snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  start(): void {
    if (this.#abort) return
    this.#setSnapshot({ status: 'loading' })
    const abort = new AbortController()
    this.#abort = abort
    this.#unsubscribeRuntime = this.#events.subscribe('runtime-state', state => this.#replace(state))
    void this.#api.getRuntimeState(abort.signal)
      .then(state => {
        if (!abort.signal.aborted) this.#replace(state)
      })
      .catch(cause => {
        if (abort.signal.aborted || this.#snapshot.status === 'ready') return
        this.#setSnapshot({
          status: 'error',
          error: cause instanceof Error ? cause.message : 'Runtime state unavailable.'
        })
      })
  }

  stop(): void {
    this.#abort?.abort()
    this.#abort = undefined
    this.#unsubscribeRuntime?.()
    this.#unsubscribeRuntime = undefined
    this.#setSnapshot({ status: 'idle' })
  }

  #replace(state: RuntimeState): void {
    if (this.#snapshot.status === 'ready' && state.revision < this.#snapshot.state.revision) return
    this.#setSnapshot({ status: 'ready', state })
  }

  #setSnapshot(snapshot: RuntimeStateSnapshot): void {
    if (snapshot.status === this.#snapshot.status) {
      if (snapshot.status === 'idle' || snapshot.status === 'loading') return
      if (snapshot.status === 'error' && this.#snapshot.status === 'error' && snapshot.error === this.#snapshot.error) return
      if (snapshot.status === 'ready' && this.#snapshot.status === 'ready' && snapshot.state === this.#snapshot.state) return
    }
    this.#snapshot = snapshot
    for (const listener of this.#listeners) listener()
  }
}
