import type { NavigationItem } from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type NumpadRoute = Extract<PhoenixRoute, { kind: 'numpad' }>
type NumpadNavigationItem = NavigationItem & { route: NumpadRoute }

export const numpadNavigationItems: NumpadNavigationItem[] = [
  item('navigator', 'Navigator', 'NAV'),
  item('shortcuts', 'Custom shortcuts', 'CUT')
]

export function numpadContext(route: PhoenixRoute): NumpadRoute['view'] {
  return route.kind === 'numpad' ? route.view : 'navigator'
}

function item(view: NumpadRoute['view'], label: string, shortLabel: string): NumpadNavigationItem {
  const route: NumpadRoute = { kind: 'numpad', view }
  return { id: view, label, shortLabel, route, href: phoenixRouteHash(route) }
}
