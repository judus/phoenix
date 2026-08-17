import type { NavigationItem } from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type SettingsRoute = Extract<PhoenixRoute, { kind: 'settings' }>

const definitions = [
  ['copilot', 'Copilot', 'CPL'],
  ['audio', 'Audio', 'AUD'],
  ['device', 'This device', 'DVC'],
  ['controls', 'Controls', 'CTL'],
  ['pairing', 'Pairing', 'PAR']
] as const

export const settingsNavigationItems: Array<NavigationItem & { route: SettingsRoute }> = definitions.map(([view, label, shortLabel]) => {
  const route: SettingsRoute = { kind: 'settings', view }
  return { id: view, label, shortLabel, route, href: phoenixRouteHash(route) }
})

export function settingsContext(route: PhoenixRoute): string {
  return route.kind === 'settings' ? route.view : 'copilot'
}
