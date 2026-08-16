import type { ApplicationNavigationItem, NavigationItem } from '@phoenix/ui'
import {
  HOME_ROUTE,
  defaultRouteForInformationSection,
  defaultRouteForWorkspace,
  type InformationPrimarySection,
  type InformationRoute,
  type PhoenixRoute
} from '../../platform/routing/phoenix-route.js'
import { phoenixRouteHash } from '../../platform/routing/phoenix-router.js'

export type RouteNavigationItem = NavigationItem & { route: PhoenixRoute }

export function utilityItems(fullscreen: { active: boolean, supported: boolean }): ApplicationNavigationItem[] {
  return [
    routeItem('telemetry', 'Numpad', '123', { kind: 'numpad', view: 'navigator' }),
    routeItem('macros', 'Macros', 'MAC', { kind: 'macros' }),
    routeItem('journal', 'Journal log', 'LOG', { kind: 'journal' }),
    routeItem('developer', 'Developer tools', 'DEV', { kind: 'developer', view: 'overview' }),
    routeItem('settings', 'Settings', '⚙', { kind: 'settings', view: 'system' }),
    {
      id: 'fullscreen',
      kind: 'action',
      label: fullscreen.active ? 'Exit fullscreen' : 'Enter fullscreen',
      shortLabel: '⛶',
      pressed: fullscreen.active,
      disabled: !fullscreen.supported
    }
  ]
}

export const primaryItems: RouteNavigationItem[] = [
  informationItem('commander', 'Commander'),
  informationItem('fleet', 'Fleet'),
  informationItem('galaxy', 'Galaxy'),
  informationItem('operations', 'Operations'),
  informationItem('engineering', 'Engineering'),
  informationItem('comms', 'Comms')
]

export const contextItems: RouteNavigationItem[] = [
  routeItem('overview', 'Overview', '◇', HOME_ROUTE),
  routeItem('ship', 'Current ship', 'SHP', { kind: 'information', section: 'fleet', view: 'current-overview' }),
  { ...routeItem('alerts', 'Alerts', 'ALT', { kind: 'information', section: 'operations', view: 'overview' }), badge: '2' }
]

export function workspaceItems(informationRoute: InformationRoute): RouteNavigationItem[] {
  return [
    routeItem('controls', 'Controls', undefined, defaultRouteForWorkspace('controls')),
    routeItem('info', 'Info', undefined, informationRoute),
    routeItem('copilot', 'Copilot', undefined, defaultRouteForWorkspace('copilot'))
  ]
}

export function contextForInformationRoute(route: InformationRoute): 'overview' | 'ship' | 'alerts' {
  if (route.section === 'fleet' && route.view.startsWith('current-')) return 'ship'
  if (route.section === 'operations') return 'alerts'
  return 'overview'
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
