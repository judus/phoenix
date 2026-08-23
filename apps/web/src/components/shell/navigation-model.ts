import type { ApplicationNavigationItem, NavigationItem } from '@phoenix/ui'
import {
  HOME_ROUTE,
  defaultRouteForInformationSection,
  defaultRouteForWorkspace,
  type InformationPrimarySection,
  type InformationRoute,
  type PhoenixRoute
} from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

export type RouteNavigationItem = NavigationItem & { route: PhoenixRoute }

export function utilityItems(fullscreen: { active: boolean, supported: boolean }): ApplicationNavigationItem[] {
  return [
    routeItem('telemetry', 'Numpad', '011', { kind: 'numpad' }),
    routeItem('macros', 'Macros', 'MCR', { kind: 'macros' }),
    routeItem('journal', 'Journal log', 'LOG', { kind: 'journal', view: 'journal' }),
    routeItem('settings', 'Settings', 'STG', { kind: 'settings', view: 'dashboard' }),
    {
      id: 'fullscreen',
      kind: 'action',
      label: fullscreen.active ? 'Exit fullscreen' : 'Enter fullscreen',
      shortLabel: 'F11',
      pressed: fullscreen.active,
      disabled: !fullscreen.supported
    }
  ]
}

export const primaryItems: RouteNavigationItem[] = [
  informationItem('commander', 'Commander'),
  informationItem('fleet', 'Fleet'),
  informationItem('galaxy', 'Galaxy'),
  informationItem('activities', 'Activities'),
  informationItem('engineering', 'Engineering'),
  informationItem('comms', 'Comms')
]

export const emptyContextItems: NavigationItem[] = []

export function workspaceItems(informationRoute: InformationRoute): RouteNavigationItem[] {
  return [
    routeItem('controls', 'Controls', 'CTR', defaultRouteForWorkspace('controls')),
    routeItem('info', 'Info', 'INF', informationRoute),
    routeItem('copilot', 'Copilot', 'CPT', defaultRouteForWorkspace('copilot'))
  ]
}

export const homeItem: RouteNavigationItem = routeItem('home', 'Home', undefined, HOME_ROUTE)

export function isRouteNavigationItem(item: ApplicationNavigationItem): item is RouteNavigationItem {
  return 'route' in item
}

function informationItem(section: Exclude<InformationPrimarySection, 'home'>, label: string): RouteNavigationItem {
  return routeItem(section, label, undefined, defaultRouteForInformationSection(section))
}

function routeItem(id: string, label: string, shortLabel: string | undefined, route: PhoenixRoute): RouteNavigationItem {
  return {
    id,
    label,
    ...(shortLabel ? { shortLabel } : {}),
    href: phoenixRouteHash(route),
    route
  }
}
