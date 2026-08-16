import type { NavigationItem } from '@phoenix/ui'
import type { InformationRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type FleetNavigationItem = NavigationItem & { route: InformationRoute }

const routes = {
  overview: { kind: 'information', section: 'fleet', view: 'overview' },
  current: { kind: 'information', section: 'fleet', view: 'current-overview' },
  carriers: { kind: 'information', section: 'fleet', view: 'carriers' },
  'stored-modules': { kind: 'information', section: 'fleet', view: 'stored-modules' },
  catalogue: { kind: 'information', section: 'fleet', view: 'catalogue' }
} as const satisfies Record<string, InformationRoute>

export const fleetNavigationItems: FleetNavigationItem[] = [
  item('overview', 'Overview', 'FLT'),
  item('current', 'Current ship', 'SHIP'),
  item('carriers', 'Carriers', 'CAR'),
  item('stored-modules', 'Stored modules', 'MOD'),
  item('catalogue', 'Ship catalogue', 'CAT')
]

export function fleetContextForRoute(route: InformationRoute): string {
  if (route.section !== 'fleet') return 'overview'
  return route.view.startsWith('current-') ? 'current' : route.view
}

function item(id: keyof typeof routes, label: string, shortLabel: string): FleetNavigationItem {
  const route = routes[id]
  return { id, label, shortLabel, route, href: phoenixRouteHash(route) }
}
