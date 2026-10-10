import {
  DEFAULT_ROUTE,
  defaultRouteForWorkspace,
  isInformationRoute,
  workspaceForRoute,
  type ControlDeckId,
  type InformationRoute,
  type PhoenixRoute,
  type PhoenixWorkspace
} from '../../application/navigation/phoenix-route.js'
import {
  parsePhoenixRoute,
  phoenixRouteHash,
  type PhoenixRouter
} from '../../application/navigation/phoenix-router.js'

const INFORMATION_ROUTE_STORAGE_KEY = 'phoenix.desktop.information-route'

type BrowserWindow = Pick<Window, 'addEventListener' | 'history' | 'location' | 'removeEventListener' | 'sessionStorage'>

export class BrowserPhoenixRouter implements PhoenixRouter {
  readonly #window: BrowserWindow
  readonly #listeners = new Set<() => void>()
  readonly #handleBrowserNavigation = (): void => this.#synchronizeFromBrowser()
  #route: PhoenixRoute
  #rememberedInformation: InformationRoute
  readonly #rememberedWorkspaces = new Map<PhoenixWorkspace, PhoenixRoute>()

  constructor(browserWindow: BrowserWindow) {
    this.#window = browserWindow
    this.#route = parsePhoenixRoute(browserWindow.location.hash)
    const canonicalHash = phoenixRouteHash(this.#route)
    if (browserWindow.location.hash !== canonicalHash) {
      browserWindow.history.replaceState(null, '', canonicalHash)
    }
    this.#rememberedInformation = this.#readRememberedInformation(this.#route)
    for (const workspace of ['controls', 'copilot', 'notes'] as const) {
      try {
        const hash = browserWindow.sessionStorage.getItem(`phoenix.desktop.${workspace}-route`)
        if (!hash) continue
        const route = parsePhoenixRoute(hash)
        if (workspaceForRoute(route) === workspace && !(route.kind === 'controls' && route.deckId === 'manage')) this.#rememberedWorkspaces.set(workspace, route)
      } catch {
        // Session preferences may be unavailable; in-memory recall still works.
      }
    }
    this.#rememberWorkspace(this.#route)
    if (isInformationRoute(this.#route)) this.#rememberInformation(this.#route)
  }

  getSnapshot = (): PhoenixRoute => this.#route

  getRememberedInformationRoute = (): InformationRoute => this.#rememberedInformation

  href = (route: PhoenixRoute): string => phoenixRouteHash(route)

  push = (route: PhoenixRoute): void => this.#navigate(route, false)

  replace = (route: PhoenixRoute): void => this.#navigate(route, true)

  routeForWorkspace = (workspace: PhoenixWorkspace, firstControlDeckId: ControlDeckId = 'quick'): PhoenixRoute => {
    if (workspaceForRoute(this.#route) === workspace) return this.#route
    const remembered = this.#rememberedWorkspaces.get(workspace)
    if (remembered) return remembered
    if (workspace === 'controls') return { kind: 'controls', deckId: firstControlDeckId }
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
    this.#rememberWorkspace(route)
    if (isInformationRoute(route)) this.#rememberInformation(route)
    for (const listener of this.#listeners) listener()
  }

  #readRememberedInformation(current: PhoenixRoute): InformationRoute {
    if (isInformationRoute(current)) return current
    let stored: string | null = null
    try {
      stored = this.#window.sessionStorage.getItem(INFORMATION_ROUTE_STORAGE_KEY)
    } catch {
      return DEFAULT_ROUTE
    }
    if (!stored) return DEFAULT_ROUTE
    const route = parsePhoenixRoute(stored)
    return isInformationRoute(route) ? route : DEFAULT_ROUTE
  }

  #rememberInformation(route: InformationRoute): void {
    this.#rememberedInformation = route
    try {
      this.#window.sessionStorage.setItem(INFORMATION_ROUTE_STORAGE_KEY, phoenixRouteHash(route))
    } catch {
      // Browser storage is an optional preference; routing remains authoritative without it.
    }
  }

  #rememberWorkspace(route: PhoenixRoute): void {
    if (route.kind !== 'controls' && route.kind !== 'copilot' && route.kind !== 'notes') return
    if (route.kind === 'controls' && route.deckId === 'manage') return
    this.#rememberedWorkspaces.set(route.kind, route)
    try {
      this.#window.sessionStorage.setItem(`phoenix.desktop.${route.kind}-route`, phoenixRouteHash(route))
    } catch {
      // Browser storage is optional; retain this session's in-memory destination.
    }
  }
}
