import { parsePhoenixRoute } from './phoenix-router.js'
import type { PhoenixRouter } from './phoenix-router.js'

const ACTIVATE_KEY = 'phoenix.numpad.activate'
const RETURN_ROUTE_KEY = 'phoenix.numpad.return-route'

export interface NumpadRouteSession {
  acknowledge(): void
  arm(): void
  discard(): void
  isArmed(): boolean
  leave(): boolean
  navigate(href: string): void
}

export class RouterNumpadRouteSession implements NumpadRouteSession {
  readonly #router: PhoenixRouter
  readonly #storage: Storage

  constructor(router: PhoenixRouter, storage: Storage) {
    this.#router = router
    this.#storage = storage
  }

  acknowledge(): void {
    this.#remove(ACTIVATE_KEY)
  }

  arm(): void {
    this.#set(ACTIVATE_KEY, 'true')
    this.#set(RETURN_ROUTE_KEY, this.#router.href(this.#router.getSnapshot()))
  }

  discard(): void {
    this.#remove(ACTIVATE_KEY)
    this.#remove(RETURN_ROUTE_KEY)
  }

  isArmed(): boolean {
    return this.#get(ACTIVATE_KEY) === 'true'
  }

  leave(): boolean {
    const destination = this.#get(RETURN_ROUTE_KEY)
    this.discard()
    if (!destination) return false
    this.#router.push(parsePhoenixRoute(destination))
    return true
  }

  navigate(href: string): void {
    this.discard()
    this.#router.push(parsePhoenixRoute(href))
  }

  #get(key: string): string | null {
    try { return this.#storage.getItem(key) } catch { return null }
  }

  #remove(key: string): void {
    try { this.#storage.removeItem(key) } catch {}
  }

  #set(key: string, value: string): void {
    try { this.#storage.setItem(key, value) } catch {}
  }
}
