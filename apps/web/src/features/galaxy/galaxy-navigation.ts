import type { NavigationItem } from '@phoenix/ui'
import type { InformationRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type GalaxyNavigationItem = NavigationItem & { route: InformationRoute }

const routes = {
  system: { kind: 'information', section: 'galaxy', view: 'system' },
  route: { kind: 'information', section: 'galaxy', view: 'route' },
  database: { kind: 'information', section: 'galaxy', view: 'database' }
} as const satisfies Record<string, InformationRoute>

export const galaxyNavigationItems: GalaxyNavigationItem[] = [
  item('system', 'Current system', 'SYS'),
  item('route', 'Plotted route', 'RTE'),
  item('database', 'Galaxy database', 'DBS')
]

export function galaxyContextForRoute(route: InformationRoute): string {
  return route.section === 'galaxy' ? route.view : 'system'
}

function item(id: keyof typeof routes, label: string, shortLabel: string): GalaxyNavigationItem {
  const route = routes[id]
  return { id, label, shortLabel, route, href: phoenixRouteHash(route) }
}
