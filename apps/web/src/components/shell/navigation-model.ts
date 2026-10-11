import type { ApplicationNavigationItem, NavigationItem } from '@phoenix/ui'
import {
  defaultRouteForInformationSection,
  defaultRouteForWorkspace,
  type InformationPrimarySection,
  type InformationRoute,
  type PhoenixRoute
} from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

export type RouteNavigationItem = NavigationItem & { route: PhoenixRoute }

export function utilityItems(fullscreen: { active: boolean, supported: boolean }, focusActive = false, androidShell = false): ApplicationNavigationItem[] {
  return [
    androidShell ? {
      id: 'reload',
      kind: 'action',
      label: 'Reload PHOENIX',
      shortLabel: 'RLD'
    } : {
      id: 'fullscreen',
      kind: 'action' as const,
      label: fullscreen.active ? 'Exit fullscreen' : 'Enter fullscreen',
      shortLabel: 'F11',
      pressed: fullscreen.active,
      disabled: !fullscreen.supported
    },
    {
      id: 'focus',
      kind: 'action',
      label: focusActive ? 'Exit focus view' : 'Enter focus view',
      shortLabel: 'F13',
      pressed: focusActive
    }
  ]
}

export const primaryItems: RouteNavigationItem[] = [
  informationItem('commander', 'Commander'),
  informationItem('fleet', 'Fleet'),
  informationItem('galaxy', 'Galaxy'),
  informationItem('activities', 'Activities'),
  informationItem('engineering', 'Engineering'),
  informationItem('equipment', 'Equipment'),
  informationItem('comms', 'Comms')
]

export const emptyContextItems: NavigationItem[] = []

export function workspaceItems(informationRoute: InformationRoute, controlsRoute = defaultRouteForWorkspace('controls'), copilotRoute = defaultRouteForWorkspace('copilot'), journalRoute = defaultRouteForWorkspace('journal'), { showDeveloper = false, showNumpadButton = false }: { showDeveloper?: boolean, showNumpadButton?: boolean } = {}): RouteNavigationItem[] {
  return [
    ...(showNumpadButton ? [routeItem('telemetry', 'Numpad', '011', { kind: 'numpad' })] : []),
    routeItem('controls', 'Controls', 'CTR', controlsRoute),
    routeItem('info', 'Info', 'INF', informationRoute),
    routeItem('journal', 'Log', 'LOG', journalRoute),
    routeItem('copilot', 'Copilot', 'CPT', copilotRoute),
    routeItem('settings', 'Settings', 'STG', defaultRouteForWorkspace('settings')),
    ...(showDeveloper ? [routeItem('developer', 'Developer tools', 'DEV', { kind: 'developer', view: 'tools' })] : [])
  ]
}

export function isRouteNavigationItem(item: ApplicationNavigationItem): item is RouteNavigationItem {
  return 'route' in item
}

function informationItem(section: InformationPrimarySection, label: string): RouteNavigationItem {
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
