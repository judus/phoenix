import type { NavigationItem } from '@phoenix/ui'
import type { InformationRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type ActivitiesRoute = Extract<InformationRoute, { section: 'activities' }>
type ActivitiesNavigationItem = NavigationItem & { route: ActivitiesRoute }

const routes = {
  missions: { kind: 'information', section: 'activities', view: 'missions' },
  objectives: { kind: 'information', section: 'activities', view: 'objectives' },
  'community-goals': { kind: 'information', section: 'activities', view: 'community-goals' },
  powerplay: { kind: 'information', section: 'activities', view: 'powerplay' },
  colonisation: { kind: 'information', section: 'activities', view: 'colonisation' }
} as const satisfies Record<string, ActivitiesRoute>

export const activitiesNavigationItems: ActivitiesNavigationItem[] = [
  item('missions', 'Missions', 'MIS'),
  item('objectives', 'Objectives', 'OBJ'),
  item('community-goals', 'Community goals', 'CMG'),
  item('powerplay', 'Powerplay', 'PWR'),
  item('colonisation', 'Colonisation', 'COL')
]

export function activitiesNavigationItemsForRoute(route: ActivitiesRoute): ActivitiesNavigationItem[] {
  if (!route.fixture) return activitiesNavigationItems
  return activitiesNavigationItems.map(item => {
    const fixtureRoute = { ...item.route, fixture: route.fixture }
    return { ...item, route: fixtureRoute, href: phoenixRouteHash(fixtureRoute) }
  })
}

export function activitiesContextForRoute(route: InformationRoute): string {
  return route.section === 'activities' ? route.view : 'missions'
}

function item(id: keyof typeof routes, label: string, shortLabel: string): ActivitiesNavigationItem {
  const route = routes[id]
  return { id, label, shortLabel, route, href: phoenixRouteHash(route) }
}
