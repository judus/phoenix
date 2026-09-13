import type { NavigationItem } from '@phoenix/ui'
import type { InformationRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type GalaxyNavigationItem = NavigationItem & { route: InformationRoute }

const routes = {
  system: { kind: 'information', section: 'galaxy', view: 'system' },
  route: { kind: 'information', section: 'galaxy', view: 'route' },
  database: { kind: 'information', section: 'galaxy', view: 'database' },
  'saved-queries': { kind: 'information', section: 'galaxy', view: 'saved-queries' },
  bookmarks: { kind: 'information', section: 'galaxy', view: 'bookmarks' },
  exobiology: { kind: 'information', section: 'galaxy', view: 'exobiology' }
} as const satisfies Record<string, InformationRoute>

export const galaxyNavigationItems: GalaxyNavigationItem[] = [
  item('system', 'Current system', 'SYS'),
  item('route', 'Plotted route', 'RTE'),
  item('exobiology', 'Exobiology', 'EXO'),
  item('database', 'Galaxy database', 'DBS'),
  item('bookmarks', 'Bookmarks', 'BMK'),
  item('saved-queries', 'Saved queries', 'SVQ')
]

export function galaxyContextForRoute(route: InformationRoute): string {
  if (route.section !== 'galaxy') return 'system'
  return route.view
}

function item(id: keyof typeof routes, label: string, shortLabel: string): GalaxyNavigationItem {
  const route = routes[id]
  return { id, label, shortLabel, route, href: phoenixRouteHash(route) }
}
