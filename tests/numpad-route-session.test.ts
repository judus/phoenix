import { expect, test, vi } from 'vitest'
import type { InformationRoute, PhoenixRoute } from '../apps/web/src/application/navigation/phoenix-route.js'
import { RouterNumpadRouteSession } from '../apps/web/src/application/navigation/numpad-route-session.js'
import type { PhoenixRouter } from '../apps/web/src/application/navigation/phoenix-router.js'

test('Numpad route sessions return through the typed router', () => {
  const router = new FakeRouter({ kind: 'information', section: 'fleet', view: 'overview' })
  const storage = new MemoryStorage()
  const session = new RouterNumpadRouteSession(router, storage)

  session.arm()
  expect(session.isArmed()).toBe(true)
  session.acknowledge()
  expect(session.isArmed()).toBe(false)

  expect(session.leave()).toBe(true)
  expect(router.push).toHaveBeenCalledWith({ kind: 'information', section: 'fleet', view: 'overview' })
  expect(session.leave()).toBe(false)
})

test('Numpad navigation commands discard the return route and canonicalize through PhoenixRouter', () => {
  const router = new FakeRouter({ kind: 'information', section: 'fleet', view: 'overview' })
  const session = new RouterNumpadRouteSession(router, new MemoryStorage())

  session.arm()
  session.navigate('#/operations/missions')

  expect(router.push).toHaveBeenCalledWith({ kind: 'information', section: 'activities', view: 'missions' })
  expect(session.leave()).toBe(false)
})

class FakeRouter implements PhoenixRouter {
  readonly push = vi.fn<(route: PhoenixRoute) => void>()
  readonly replace = vi.fn<(route: PhoenixRoute) => void>()
  #route: PhoenixRoute

  constructor(route: PhoenixRoute) { this.#route = route }
  getSnapshot = (): PhoenixRoute => this.#route
  getRememberedInformationRoute = (): InformationRoute => ({ kind: 'information', section: 'home', view: 'overview' })
  href = (route: PhoenixRoute): string => route.kind === 'information' && route.section === 'fleet' ? '#/fleet/overview' : '#/'
  routeForWorkspace = (): PhoenixRoute => ({ kind: 'information', section: 'home', view: 'overview' })
  subscribe = (): (() => void) => () => undefined
}

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>()
  get length(): number { return this.#values.size }
  clear(): void { this.#values.clear() }
  getItem(key: string): string | null { return this.#values.get(key) ?? null }
  key(index: number): string | null { return [...this.#values.keys()][index] ?? null }
  removeItem(key: string): void { this.#values.delete(key) }
  setItem(key: string, value: string): void { this.#values.set(key, value) }
}
