import type { NavigationItem } from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type JournalNavigationItem = NavigationItem & { route: PhoenixRoute }

export const journalNavigationItems: JournalNavigationItem[] = [
  item('notes', 'Notes', 'NTS', { kind: 'notes' }),
  item('commander', 'Commander log', 'CMD', { kind: 'journal', view: 'commander' }),
  item('credits', 'Credits', 'CRD', { kind: 'journal', view: 'credits' })
]

export const developerNavigationItems: JournalNavigationItem[] = [
  item('journal', 'Raw journal', 'JRN', { kind: 'developer', view: 'journal' }),
  item('tools', 'Copilot tool injection', 'TLS', { kind: 'developer', view: 'tools' }),
  item('eddn', 'EDDN submissions', 'EDDN', { kind: 'developer', view: 'eddn' })
]

export function journalContext(route: PhoenixRoute): string {
  if (route.kind === 'notes') return 'notes'
  if (route.kind === 'developer') return route.view
  if (route.kind === 'journal') return route.view
  return 'commander'
}

function item(id: string, label: string, shortLabel: string, route: PhoenixRoute): JournalNavigationItem {
  return { id, label, shortLabel, href: phoenixRouteHash(route), route }
}
