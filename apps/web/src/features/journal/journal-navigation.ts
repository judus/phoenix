import type { NavigationItem } from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type JournalNavigationItem = NavigationItem & { route: PhoenixRoute }

export const journalNavigationItems: JournalNavigationItem[] = [
  item('journal', 'Journal', 'JRN', { kind: 'journal', view: 'journal' }),
  item('developer', 'Developer tools', 'DEV', { kind: 'developer', view: 'overview' }),
  item('credits', 'Credits', 'CRD', { kind: 'journal', view: 'credits' })
]

export function journalContext(route: PhoenixRoute): string {
  if (route.kind === 'developer') return 'developer'
  if (route.kind === 'journal') return route.view
  return 'journal'
}

function item(id: string, label: string, shortLabel: string, route: PhoenixRoute): JournalNavigationItem {
  return { id, label, shortLabel, href: phoenixRouteHash(route), route }
}
