import { describe, expect, test } from 'vitest'
import { BrowserPhoenixRouter } from '../apps/web/src/platform/routing/browser-phoenix-router.js'

describe('BrowserPhoenixRouter', () => {
  test('push and replace update history and notify subscribers once', () => {
    const browser = new FakeBrowserWindow('#/')
    const router = new BrowserPhoenixRouter(browser as unknown as Window)
    let notifications = 0
    const unsubscribe = router.subscribe(() => { notifications += 1 })

    router.push({ kind: 'information', section: 'fleet', view: 'overview' })
    expect(browser.location.hash).toBe('#/fleet/overview')
    expect(browser.historyCalls).toEqual([['push', '#/fleet/overview']])
    expect(notifications).toBe(1)

    router.replace({ kind: 'settings', view: 'system' })
    expect(browser.location.hash).toBe('#/settings/system')
    expect(browser.historyCalls.at(-1)).toEqual(['replace', '#/settings/system'])
    expect(notifications).toBe(2)

    unsubscribe()
    expect(browser.listenerCount()).toBe(0)
  })

  test('back and forward browser events update one stable snapshot', () => {
    const browser = new FakeBrowserWindow('#/settings/system')
    const router = new BrowserPhoenixRouter(browser as unknown as Window)
    const snapshots: string[] = []
    router.subscribe(() => snapshots.push(router.href(router.getSnapshot())))

    browser.navigateFromBrowser('#/copilot/chat')
    browser.dispatch('hashchange')

    expect(router.getSnapshot()).toEqual({ kind: 'copilot', view: 'chat' })
    expect(snapshots).toEqual(['#/copilot/chat'])
  })

  test('utility routes do not overwrite the remembered Information destination', () => {
    const browser = new FakeBrowserWindow('#/fleet/catalogue')
    const router = new BrowserPhoenixRouter(browser as unknown as Window)

    router.push({ kind: 'developer', view: 'overview' })

    expect(router.routeForWorkspace('info')).toEqual({
      kind: 'information',
      section: 'fleet',
      view: 'catalogue'
    })
    expect(browser.sessionStorage.getItem('phoenix.desktop.information-route')).toBe('#/fleet/catalogue')

    const restored = new BrowserPhoenixRouter(browser as unknown as Window)
    expect(restored.routeForWorkspace('info')).toEqual(router.routeForWorkspace('info'))
  })
})

class FakeBrowserWindow {
  readonly location: { hash: string }
  readonly sessionStorage = new MemoryStorage()
  readonly historyCalls: Array<['push' | 'replace', string]> = []
  readonly history = {
    pushState: (_data: unknown, _unused: string, url?: string | URL | null) => this.setHistory('push', url),
    replaceState: (_data: unknown, _unused: string, url?: string | URL | null) => this.setHistory('replace', url)
  }
  readonly #listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()

  constructor(hash: string) {
    this.location = { hash }
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.#listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.#listeners.get(type)?.delete(listener)
  }

  dispatch(type: string): void {
    const event = new Event(type)
    for (const listener of this.#listeners.get(type) ?? []) {
      if (typeof listener === 'function') listener(event)
      else listener.handleEvent(event)
    }
  }

  navigateFromBrowser(hash: string): void {
    this.location.hash = hash
    this.dispatch('popstate')
  }

  listenerCount(): number {
    return [...this.#listeners.values()].reduce((total, listeners) => total + listeners.size, 0)
  }

  private setHistory(method: 'push' | 'replace', url?: string | URL | null): void {
    const destination = String(url ?? '')
    this.location.hash = destination
    this.historyCalls.push([method, destination])
  }
}

class MemoryStorage {
  readonly #values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value)
  }
}
