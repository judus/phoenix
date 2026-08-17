import type { NavigationItem } from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type SettingsRoute = Extract<PhoenixRoute, { kind: 'settings' }>

const route: SettingsRoute = { kind: 'settings', view: 'dashboard' }

export const settingsNavigationItems: Array<NavigationItem & { route: SettingsRoute }> = [{
  id: 'settings',
  label: 'Settings',
  shortLabel: 'STG',
  route,
  href: phoenixRouteHash(route)
}]

export function settingsContext(): string {
  return 'settings'
}
