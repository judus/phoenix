import type { NavigationItem } from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type CopilotRoute = Extract<PhoenixRoute, { kind: 'copilot' }>
type CopilotNavigationItem = NavigationItem & { route: CopilotRoute }

export const copilotNavigationItems: CopilotNavigationItem[] = [
  item('chat', 'Conversation', 'CHT'),
  item('profiles', 'Profiles', 'PRO')
]

export function copilotContext(route: PhoenixRoute): CopilotRoute['view'] {
  return route.kind === 'copilot' ? route.view : 'chat'
}

function item(view: CopilotRoute['view'], label: string, shortLabel: string): CopilotNavigationItem {
  const route: CopilotRoute = { kind: 'copilot', view }
  return { id: view, label, shortLabel, route, href: phoenixRouteHash(route) }
}
