export const CONTROL_CATEGORIES = [
  'ship',
  'combat',
  'navigation',
  'vessel',
  'srv',
  'on_foot',
  'radio',
  'emote',
  'misc'
] as const

export type ControlCategory = typeof CONTROL_CATEGORIES[number]

export type InformationPrimarySection =
  | 'home'
  | 'commander'
  | 'fleet'
  | 'galaxy'
  | 'activities'
  | 'engineering'
  | 'comms'

export { GALAXY_QUERY_IDS, type GalaxyQueryId } from '@phoenix/contracts'

export type InformationRoute =
  | { kind: 'information', section: 'home', view: 'overview' }
  | { kind: 'information', section: 'commander', view: 'career' | 'statistics' | 'inventory' }
  | { kind: 'information', section: 'fleet', view: 'overview' | 'current-overview' | 'current-loadout' | 'current-cargo' | 'current-engineering' | 'carriers' | 'stored-modules' }
  | { kind: 'information', section: 'fleet', view: 'catalogue', selectedShipId?: string }
  | { kind: 'information', section: 'galaxy', view: 'system', systemName?: string, selectedName?: string }
  | { kind: 'information', section: 'galaxy', view: 'route' }
  | { kind: 'information', section: 'galaxy', view: 'exobiology' }
  | { kind: 'information', section: 'galaxy', view: 'bookmarks', bookmarkId?: string, systemName?: string, bodyName?: string }
  | { kind: 'information', section: 'galaxy', view: 'database', savedQueryId?: string, savedQueryRunId?: string, selectedQueryId?: GalaxyQueryId }
  | { kind: 'information', section: 'galaxy', view: 'saved-queries' }
  | { kind: 'information', section: 'activities', view: 'missions' | 'objectives' | 'community-goals' | 'powerplay' | 'colonisation' }
  | { kind: 'information', section: 'engineering', view: 'blueprints', selectedBlueprintSymbol?: string }
  | { kind: 'information', section: 'engineering', view: 'engineers' | 'materials-raw' | 'materials-manufactured' | 'materials-encoded' | 'materials-xeno' }
  | { kind: 'information', section: 'comms', view: 'inbox' | 'traffic' | 'contacts' | 'galnet' | 'radio' }

export type PhoenixRoute =
  | InformationRoute
  | { kind: 'controls', category: ControlCategory }
  | { kind: 'copilot', view: 'chat' | 'profiles' }
  | { kind: 'numpad' }
  | { kind: 'macros' }
  | { kind: 'journal', view: 'journal' | 'credits' }
  | { kind: 'developer', view: 'overview' | 'runtime' | 'elite' | 'health' | 'tests' | 'controls' }
  | { kind: 'settings', view: 'dashboard' | 'help' }

export type PhoenixWorkspace =
  | 'controls'
  | 'info'
  | 'copilot'
  | 'telemetry'
  | 'macros'
  | 'journal'
  | 'settings'

export const HOME_ROUTE: InformationRoute = {
  kind: 'information',
  section: 'home',
  view: 'overview'
}

export function isInformationRoute(route: PhoenixRoute): route is InformationRoute {
  return route.kind === 'information'
}

export function isPhoenixWorkspace(value: string): value is PhoenixWorkspace {
  return [
    'controls',
    'info',
    'copilot',
    'telemetry',
    'macros',
    'journal',
    'settings'
  ].includes(value)
}

export function workspaceForRoute(route: PhoenixRoute): PhoenixWorkspace {
  if (route.kind === 'information') return 'info'
  if (route.kind === 'numpad') return 'telemetry'
  if (route.kind === 'developer') return 'journal'
  return route.kind
}

export function defaultRouteForInformationSection(section: InformationPrimarySection): InformationRoute {
  switch (section) {
    case 'home': return HOME_ROUTE
    case 'commander': return { kind: 'information', section, view: 'career' }
    case 'fleet': return { kind: 'information', section, view: 'current-overview' }
    case 'galaxy': return { kind: 'information', section, view: 'system' }
    case 'activities': return { kind: 'information', section, view: 'missions' }
    case 'engineering': return { kind: 'information', section, view: 'blueprints' }
    case 'comms': return { kind: 'information', section, view: 'inbox' }
  }
}

export function defaultRouteForWorkspace(
  workspace: PhoenixWorkspace,
  rememberedInformation: InformationRoute = HOME_ROUTE
): PhoenixRoute {
  switch (workspace) {
    case 'controls': return { kind: 'controls', category: 'ship' }
    case 'info': return rememberedInformation
    case 'copilot': return { kind: 'copilot', view: 'chat' }
    case 'telemetry': return { kind: 'numpad' }
    case 'macros': return { kind: 'macros' }
    case 'journal': return { kind: 'journal', view: 'journal' }
    case 'settings': return { kind: 'settings', view: 'dashboard' }
  }
}
import type { GalaxyQueryId } from '@phoenix/contracts'
