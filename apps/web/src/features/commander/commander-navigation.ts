import type { NavigationItem } from '@phoenix/ui'
import type { InformationRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type CommanderNavigationItem = NavigationItem & { route: InformationRoute }

const routes = {
  overview: { kind: 'information', section: 'commander', view: 'overview' },
  inventory: { kind: 'information', section: 'commander', view: 'inventory' },
  progress: { kind: 'information', section: 'commander', view: 'progress' }
} as const satisfies Record<string, InformationRoute>

export const commanderNavigationItems: CommanderNavigationItem[] = [
  item('overview', 'Overview', 'CMD'),
  item('inventory', 'Personal stores', 'INV'),
  item('progress', 'Career progress', 'RANK')
]

export function commanderContextForRoute(route: InformationRoute): string {
  return route.section === 'commander' ? route.view : 'overview'
}

function item(id: keyof typeof routes, label: string, shortLabel: string): CommanderNavigationItem {
  const route = routes[id]
  return { id, label, shortLabel, route, href: phoenixRouteHash(route) }
}
