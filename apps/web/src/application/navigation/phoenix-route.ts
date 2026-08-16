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
  | 'operations'
  | 'engineering'
  | 'comms'

export const GALAXY_QUERY_IDS = [
  'commodity-markets',
  'facilities',
  'exploration-targets',
  'faction-presence',
  'filtered-systems',
  'nearby-systems',
  'outfitting-stock',
  'shipyards',
  'station-lookup',
  'trade-opportunities'
] as const

export type GalaxyQueryId = typeof GALAXY_QUERY_IDS[number]

/**
 * Transitional query preservation for routes whose feature-specific model has not migrated yet.
 * Promote meaningful values to fields on the relevant route variant before feature code consumes
 * them; feature code must not build behavior around arbitrary string-key access.
 */
export type PhoenixRouteQuery = Readonly<Record<string, string>>

export type InformationRoute =
  | { kind: 'information', section: 'home', view: 'overview', query?: PhoenixRouteQuery }
  | { kind: 'information', section: 'commander', view: 'overview' | 'inventory' | 'progress' }
  | { kind: 'information', section: 'fleet', view: 'overview' | 'current-overview' | 'current-loadout' | 'current-cargo' | 'carriers' | 'stored-modules' }
  | { kind: 'information', section: 'fleet', view: 'catalogue', selectedShipId?: string }
  | { kind: 'information', section: 'galaxy', view: 'system', systemName?: string, selectedName?: string }
  | { kind: 'information', section: 'galaxy', view: 'route' }
  | { kind: 'information', section: 'galaxy', view: 'database', selectedQueryId?: GalaxyQueryId }
  | { kind: 'information', section: 'operations', view: 'overview' | 'missions' | 'objectives' | 'community-goals' | 'powerplay' | 'colonisation', query?: PhoenixRouteQuery }
  | { kind: 'information', section: 'engineering', view: 'blueprints' | 'engineers' | 'materials-raw' | 'materials-manufactured' | 'materials-encoded' | 'materials-xeno', query?: PhoenixRouteQuery }
  | { kind: 'information', section: 'comms', view: 'overview' | 'inbox' | 'traffic' | 'contacts' | 'galnet' | 'radio', query?: PhoenixRouteQuery }
  | { kind: 'information', section: 'records', view: 'exploration-ledger' | 'exploration-body' | 'exploration-biology' | 'exploration-geology', query?: PhoenixRouteQuery }

export type PhoenixRoute =
  | InformationRoute
  | { kind: 'controls', category: ControlCategory, query?: PhoenixRouteQuery }
  | { kind: 'copilot', view: 'chat' | 'profiles', query?: PhoenixRouteQuery }
  | { kind: 'numpad', view: 'navigator' | 'shortcuts', query?: PhoenixRouteQuery }
  | { kind: 'macros', query?: PhoenixRouteQuery }
  | { kind: 'journal', query?: PhoenixRouteQuery }
  | { kind: 'developer', view: 'overview' | 'runtime' | 'elite' | 'health' | 'tests' | 'controls', query?: PhoenixRouteQuery }
  | { kind: 'settings', view: 'system' | 'audio' | 'modules' | 'pairing', query?: PhoenixRouteQuery }

export type PhoenixWorkspace =
  | 'controls'
  | 'info'
  | 'copilot'
  | 'telemetry'
  | 'macros'
  | 'journal'
  | 'developer'
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
    'developer',
    'settings'
  ].includes(value)
}

export function workspaceForRoute(route: PhoenixRoute): PhoenixWorkspace {
  if (route.kind === 'information') return 'info'
  if (route.kind === 'numpad') return 'telemetry'
  return route.kind
}

export function defaultRouteForInformationSection(section: InformationPrimarySection): InformationRoute {
  switch (section) {
    case 'home': return HOME_ROUTE
    case 'commander': return { kind: 'information', section, view: 'overview' }
    case 'fleet': return { kind: 'information', section, view: 'overview' }
    case 'galaxy': return { kind: 'information', section, view: 'system' }
    case 'operations': return { kind: 'information', section, view: 'overview' }
    case 'engineering': return { kind: 'information', section, view: 'blueprints' }
    case 'comms': return { kind: 'information', section, view: 'overview' }
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
    case 'telemetry': return { kind: 'numpad', view: 'navigator' }
    case 'macros': return { kind: 'macros' }
    case 'journal': return { kind: 'journal' }
    case 'developer': return { kind: 'developer', view: 'overview' }
    case 'settings': return { kind: 'settings', view: 'system' }
  }
}
