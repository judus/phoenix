import { NavigationRouteSchema, type NavigationRoute } from '@phoenix/contracts'
import type { NavigationRouteReader, NavigationRouteWriter } from '../domain/navigation.js'

const emptyRoute: NavigationRoute = { timestamp: null, route: [] }

export class InMemoryNavigationRouteStore implements NavigationRouteReader, NavigationRouteWriter {
  private route: NavigationRoute = emptyRoute

  public getCurrent (): NavigationRoute {
    return structuredClone(this.route)
  }

  public replace (route: NavigationRoute): void {
    this.route = NavigationRouteSchema.parse(structuredClone(route))
  }
}
