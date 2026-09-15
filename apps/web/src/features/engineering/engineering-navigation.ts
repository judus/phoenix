import type { NavigationItem } from '@phoenix/ui'
import type { InformationRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

type EngineeringRoute = Extract<InformationRoute, { section: 'engineering' }>
type EngineeringNavigationItem = NavigationItem & { route: EngineeringRoute }

const routes = {
  projects: { kind: 'information', section: 'engineering', view: 'projects' },
  blueprints: { kind: 'information', section: 'engineering', view: 'blueprints' },
  engineers: { kind: 'information', section: 'engineering', view: 'engineers' },
  'materials-raw': { kind: 'information', section: 'engineering', view: 'materials-raw' },
  'materials-manufactured': { kind: 'information', section: 'engineering', view: 'materials-manufactured' },
  'materials-encoded': { kind: 'information', section: 'engineering', view: 'materials-encoded' },
  'materials-xeno': { kind: 'information', section: 'engineering', view: 'materials-xeno' }
} as const satisfies Record<string, EngineeringRoute>

export const engineeringNavigationItems: EngineeringNavigationItem[] = [
  item('projects', 'Projects', 'PRJ'),
  item('blueprints', 'Blueprints', 'BLP'),
  item('engineers', 'Engineers', 'ENG'),
  item('materials-raw', 'Raw materials', 'RAW'),
  item('materials-manufactured', 'Manufactured materials', 'MAN'),
  item('materials-encoded', 'Encoded materials', 'ENC'),
  item('materials-xeno', 'Xeno materials', 'XNO')
]

export function engineeringContextForRoute(route: InformationRoute): string {
  return route.section === 'engineering'
    ? route.view.startsWith('project-') ? 'projects' : route.view
    : 'blueprints'
}

export const engineeringProjectRoutes = {
  index: routes.projects,
  new: (selectedBlueprintSymbol?: string): EngineeringRoute => ({
    kind: 'information', section: 'engineering', view: 'project-new',
    ...(selectedBlueprintSymbol ? { selectedBlueprintSymbol } : {})
  }),
  detail: (selectedProjectId: string): EngineeringRoute => ({
    kind: 'information', section: 'engineering', view: 'project-detail', selectedProjectId
  }),
  addBlueprint: (selectedBlueprintSymbol: string, selectedProjectId?: string): EngineeringRoute => ({
    kind: 'information', section: 'engineering', view: 'project-add-blueprint', selectedBlueprintSymbol,
    ...(selectedProjectId ? { selectedProjectId } : {})
  })
}

function item(id: keyof typeof routes, label: string, shortLabel: string): EngineeringNavigationItem {
  const route = routes[id]
  return { id, label, shortLabel, route, href: phoenixRouteHash(route) }
}
