import type { CartographyLookupResponse, NavigationRoute } from '@phoenix/contracts'
import type { SystemCartography } from '../domain/cartography.js'
import type { NavigationRouteReader } from '../domain/navigation.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'

export interface NavigationDataReader {
  getRoute(): NavigationRoute
  getSystem(systemName?: string): Promise<CartographyLookupResponse>
}

export class NavigationDataService implements NavigationDataReader {
  public constructor (
    private readonly cartography: SystemCartography,
    private readonly routes: NavigationRouteReader,
    private readonly runtimeState: RuntimeStateReader
  ) {}

  public getRoute (): NavigationRoute {
    return this.routes.getCurrent()
  }

  public async getSystem (systemName?: string): Promise<CartographyLookupResponse> {
    const name = systemName?.trim() || this.runtimeState.getCurrent().system.name
    if (!name) throw new Error('The current system is unknown; provide a system name.')
    return this.cartography.getSystem(name)
  }
}
