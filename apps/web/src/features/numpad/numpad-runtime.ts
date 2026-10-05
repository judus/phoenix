import { ControlDeckNumpadController, type ControlDeckNumpadSelection } from 'control-deck/core'
import type { CommandCatalogueRevision, NumpadTreeSnapshot, PhoenixModules } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../application/events/phoenix-event-hub.js'
import type { NumpadRouteSession } from '../../application/navigation/numpad-route-session.js'
import type { PhoenixRouter } from '../../application/navigation/phoenix-router.js'
import { LatestRequest } from '../../application/requests/latest-request.js'

export interface NumpadRuntimeSnapshot {
  status: 'loading' | 'ready' | 'error'
  tree?: NumpadTreeSnapshot
  settings?: PhoenixModules
  error?: string
}

/** PHOENIX owns map freshness and execution; Control Deck owns input resolution. */
export class NumpadRuntime {
  readonly controller: ControlDeckNumpadController
  readonly #latest = new LatestRequest()
  readonly #listeners = new Set<() => void>()
  #snapshot: NumpadRuntimeSnapshot = { status: 'loading' }
  #unsubscribe?: () => void
  #catalogue?: CommandCatalogueRevision

  constructor(
    private readonly api: PhoenixApi,
    private readonly events: PhoenixEventHub,
    private readonly router: PhoenixRouter,
    private readonly routeSession: NumpadRouteSession,
    scheduleNotify: (notify: () => void) => void = notify => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(notify)
      else queueMicrotask(notify)
    }
  ) {
    this.controller = new ControlDeckNumpadController({
      onAction: selection => { void this.#execute(selection) },
      onCancel: () => { this.routeSession.leave() },
      scheduleNotify
    })
  }

  getSnapshot = (): NumpadRuntimeSnapshot => this.#snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  start(): void {
    if (this.#unsubscribe) return
    const catalogue = this.events.subscribe('command-catalogue', next => {
      if (this.#catalogue?.revision === next.revision && this.#catalogue.generatedAt === next.generatedAt) return
      // Stop resolving the old map immediately, not after the replacement arrives.
      // The first SSE announcement has no old map to invalidate: preserve cold input.
      if (this.#catalogue) this.controller.invalidate()
      this.#catalogue = next
      this.#load()
    })
    const route = this.router.subscribe(() => {
      if (this.router.getSnapshot().kind !== 'numpad') {
        this.controller.reset()
        this.routeSession.discard()
      }
    })
    this.#unsubscribe = () => { catalogue(); route() }
    if (this.routeSession.isArmed()) {
      this.controller.activate()
      this.routeSession.acknowledge()
    }
    this.#load()
  }

  stop(): void {
    this.#unsubscribe?.()
    this.#unsubscribe = undefined
    this.#latest.cancel()
    this.#catalogue = undefined
    this.controller.invalidate()
    this.#snapshot = { status: 'loading' }
  }

  keyDown(event: { code: string, key: string, repeat?: boolean }, capture: boolean): boolean {
    const onPage = this.router.getSnapshot().kind === 'numpad'
    if (!capture && !onPage) return false
    const active = this.controller.getSnapshot().session.active
    if (!this.controller.keyDown(event)) return false
    if (!active && this.controller.getSnapshot().session.active) {
      if (!onPage) {
        this.routeSession.arm()
        this.router.push({ kind: 'numpad' })
        this.routeSession.acknowledge()
      }
      if (this.#snapshot.status === 'error') this.#load()
    }
    return true
  }

  #load(): void {
    const signal = this.#latest.start()
    this.#set({ status: 'loading' })
    void Promise.all([this.api.getNumpadSnapshot(signal), this.api.getModuleSettings(signal)])
      .then(([tree, settings]) => {
        if (!this.#latest.isCurrent(signal)) return
        // Publish revision before draining cold-start keys: execution must use this map.
        this.#catalogue = { revision: tree.revision, generatedAt: tree.generatedAt }
        this.#set({ status: 'ready', tree, settings })
        this.controller.setTree(tree, settings.numpadCommands.alwaysConfirm)
      })
      .catch(cause => {
        if (!this.#latest.isCurrent(signal)) return
        this.controller.invalidate()
        this.#set({ status: 'error', error: cause instanceof Error ? cause.message : 'Numpad unavailable.' })
      })
  }

  async #execute(selection: ControlDeckNumpadSelection): Promise<void> {
    const tree = this.#snapshot.tree!
    try {
      const result = await this.api.executeNumpadAddress(selection.node.address, tree.revision)
      if (!this.controller.isCurrent(selection)) return
      if (!selection.terminal && result.status === 'accepted') return
      this.controller.finish(selection, result.message)
      if (result.status !== 'accepted') return
      if (result.command?.navigationHref) this.routeSession.navigate(result.command.navigationHref)
      else this.routeSession.leave()
    } catch (cause) {
      this.controller.finish(selection, cause instanceof Error ? cause.message : 'Command execution failed.')
    }
  }

  #set(snapshot: NumpadRuntimeSnapshot): void {
    this.#snapshot = snapshot
    for (const listener of this.#listeners) listener()
  }
}
