import type { NavigationRoute } from '@phoenix/contracts'

export interface NavigationRouteReader {
  getCurrent(): NavigationRoute
}

export interface NavigationRouteWriter {
  replace(route: NavigationRoute): void
}
