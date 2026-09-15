import type { NavigationItem } from '@phoenix/ui'
import type { InformationRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type EquipmentNavigationItem = NavigationItem & { route: InformationRoute }

const routes = {
  gear: { kind: 'information', section: 'equipment', view: 'gear' },
  upgrades: { kind: 'information', section: 'equipment', view: 'upgrades' },
  specialists: { kind: 'information', section: 'equipment', view: 'specialists' },
  materials: { kind: 'information', section: 'equipment', view: 'materials' }
} as const satisfies Record<string, InformationRoute>

export const equipmentNavigationItems: EquipmentNavigationItem[] = [
  item('gear', 'Gear', 'GEA'),
  item('upgrades', 'Upgrades', 'UPG'),
  item('specialists', 'Specialists', 'SPC'),
  item('materials', 'Materials', 'MAT')
]

export function equipmentContextForRoute(route: InformationRoute): string {
  return route.section === 'equipment' ? route.view : 'gear'
}

function item(id: keyof typeof routes, label: string, shortLabel: string): EquipmentNavigationItem {
  const route = routes[id]
  return { id, label, shortLabel, route, href: phoenixRouteHash(route) }
}
