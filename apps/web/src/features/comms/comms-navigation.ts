import type { NavigationItem } from '@phoenix/ui'
import type { InformationRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type CommsRoute = Extract<InformationRoute, { section: 'comms' }>
type CommsNavigationItem = NavigationItem & { route: CommsRoute }

const routes = {
  overview: { kind: 'information', section: 'comms', view: 'overview' },
  inbox: { kind: 'information', section: 'comms', view: 'inbox' },
  traffic: { kind: 'information', section: 'comms', view: 'traffic' },
  contacts: { kind: 'information', section: 'comms', view: 'contacts' },
  galnet: { kind: 'information', section: 'comms', view: 'galnet' },
  radio: { kind: 'information', section: 'comms', view: 'radio' }
} as const satisfies Record<string, CommsRoute>

export const commsNavigationItems: CommsNavigationItem[] = [
  item('overview', 'Overview', 'COM'),
  item('inbox', 'Inbox', 'IBX'),
  item('traffic', 'Traffic', 'TRF'),
  item('contacts', 'Contacts', 'CON'),
  item('galnet', 'GalNet', 'GLN'),
  item('radio', 'Radio', 'RAD')
]

export function commsContextForRoute(route: InformationRoute): string {
  return route.section === 'comms' ? route.view : 'overview'
}

function item(id: keyof typeof routes, label: string, shortLabel: string): CommsNavigationItem {
  const route = routes[id]
  return { id, label, shortLabel, route, href: phoenixRouteHash(route) }
}
