import type { NavigationItem } from '@phoenix/ui'
import type { InformationRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type CommanderNavigationItem = NavigationItem & { route: InformationRoute }

const routes = {
  career: { kind: 'information', section: 'commander', view: 'career' },
  statistics: { kind: 'information', section: 'commander', view: 'statistics' },
  inventory: { kind: 'information', section: 'commander', view: 'inventory' },
} as const satisfies Record<string, InformationRoute>

export const commanderNavigationItems: CommanderNavigationItem[] = [
  item('career', 'Career', 'CAR'),
  item('inventory', 'Personal stores', 'INV'),
  item('statistics', 'Statistics', 'STA')
]

export function commanderContextForRoute(route: InformationRoute): string {
  return route.section === 'commander' ? route.view : 'career'
}

function item(id: keyof typeof routes, label: string, shortLabel: string): CommanderNavigationItem {
  const route = routes[id]
  return { id, label, shortLabel, route, href: phoenixRouteHash(route) }
}
