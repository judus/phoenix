import type { NavigationItem } from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type SettingsRoute = Extract<PhoenixRoute, { kind: 'settings' }>

const settingsRoute: SettingsRoute = { kind: 'settings', view: 'dashboard' }
const helpRoute: SettingsRoute = { kind: 'settings', view: 'help' }

export const settingsNavigationItems: Array<NavigationItem & { route: SettingsRoute }> = [
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'STG',
    route: settingsRoute,
    href: phoenixRouteHash(settingsRoute)
  },
  {
    id: 'help',
    label: 'Help',
    shortLabel: 'HLP',
    route: helpRoute,
    href: phoenixRouteHash(helpRoute)
  }
]

export function settingsContext(route?: SettingsRoute): string {
  return route?.view ?? 'dashboard'
}
