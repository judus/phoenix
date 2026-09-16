import type { NavigationItem } from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type SettingsRoute = Extract<PhoenixRoute, { kind: 'settings' }>

const generalRoute: SettingsRoute = { kind: 'settings', view: 'general' }
const pairingRoute: SettingsRoute = { kind: 'settings', view: 'pairing' }
const copilotRoute: SettingsRoute = { kind: 'settings', view: 'copilot' }
const helpRoute: SettingsRoute = { kind: 'settings', view: 'help' }

export const settingsNavigationItems: Array<NavigationItem & { route: SettingsRoute }> = [
  {
    id: 'general',
    label: 'General',
    shortLabel: 'GEN',
    route: generalRoute,
    href: phoenixRouteHash(generalRoute)
  },
  {
    id: 'pairing',
    label: 'Pairing',
    shortLabel: 'PAR',
    route: pairingRoute,
    href: phoenixRouteHash(pairingRoute)
  },
  {
    id: 'copilot',
    label: 'Copilot and keys',
    shortLabel: 'COP',
    route: copilotRoute,
    href: phoenixRouteHash(copilotRoute)
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
  return route?.view ?? 'general'
}
