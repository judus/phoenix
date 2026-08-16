import {
  HOME_ROUTE,
  defaultRouteForWorkspace,
  isInformationRoute,
  workspaceForRoute,
  type InformationRoute,
  type PhoenixRoute,
  type PhoenixWorkspace
} from './phoenix-route.js'
import { parsePhoenixRoute, phoenixRouteHash, type PhoenixRouter } from './phoenix-router.js'

const INFORMATION_ROUTE_STORAGE_KEY = 'phoenix.desktop.information-route'

type BrowserWindow = Pick<Window, 'addEventListener' | 'history' | 'location' | 'removeEventListener' | 'sessionStorage'>

export class BrowserPhoenixRouter implements PhoenixRouter {
  readonly #window: BrowserWindow
  readonly #listeners = new Set<() => void>()
  readonly #handleBrowserNavigation = (): void => this.#synchronizeFromBrowser()
  #route: PhoenixRoute
  #rememberedInformation: InformationRoute

  constructor(browserWindow: BrowserWindow) {
    this.#window = browserWindow
    this.#route = parsePhoenixRoute(browserWindow.location.hash)
    this.#rememberedInformation = this.#readRememberedInformation(this.#route)
    if (isInformationRoute(this.#route)) this.#rememberInformation(this.#route)
  }

  getSnapshot = (): PhoenixRoute => this.#route

  getRememberedInformationRoute = (): InformationRoute => this.#rememberedInformation

  href = (route: PhoenixRoute): string => phoenixRouteHash(route)

  push = (route: PhoenixRoute): void => this.#navigate(route, false)

  replace = (route: PhoenixRoute): void => this.#navigate(route, true)

  routeForWorkspace = (workspace: PhoenixWorkspace): PhoenixRoute => {
    if (workspaceForRoute(this.#route) === workspace) return this.#route
    return defaultRouteForWorkspace(workspace, this.#rememberedInformation)
  }

  subscribe = (listener: () => void): (() => void) => {
    if (this.#listeners.size === 0) {
      this.#window.addEventListener('hashchange', this.#handleBrowserNavigation)
      this.#window.addEventListener('popstate', this.#handleBrowserNavigation)
    }
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
      if (this.#listeners.size === 0) {
        this.#window.removeEventListener('hashchange', this.#handleBrowserNavigation)
        this.#window.removeEventListener('popstate', this.#handleBrowserNavigation)
      }
    }
  }

  #navigate(route: PhoenixRoute, replace: boolean): void {
    const destination = phoenixRouteHash(route)
    if (destination === this.#window.location.hash) return
    if (replace) this.#window.history.replaceState(null, '', destination)
    else this.#window.history.pushState(null, '', destination)
    this.#setRoute(route)
  }

  #synchronizeFromBrowser(): void {
    const route = parsePhoenixRoute(this.#window.location.hash)
    if (phoenixRouteHash(route) === phoenixRouteHash(this.#route)) return
    this.#setRoute(route)
  }

  #setRoute(route: PhoenixRoute): void {
    this.#route = route
    if (isInformationRoute(route)) this.#rememberInformation(route)
    for (const listener of this.#listeners) listener()
  }

  #readRememberedInformation(current: PhoenixRoute): InformationRoute {
    if (isInformationRoute(current)) return current
    let stored: string | null = null
    try {
      stored = this.#window.sessionStorage.getItem(INFORMATION_ROUTE_STORAGE_KEY)
    } catch {
      return HOME_ROUTE
    }
    if (!stored) return HOME_ROUTE
    const route = parsePhoenixRoute(stored)
    return isInformationRoute(route) ? route : HOME_ROUTE
  }

  #rememberInformation(route: InformationRoute): void {
    this.#rememberedInformation = route
    try {
      this.#window.sessionStorage.setItem(INFORMATION_ROUTE_STORAGE_KEY, phoenixRouteHash(route))
    } catch {
      // Browser storage is an optional preference; routing remains authoritative without it.
    }
  }
}
