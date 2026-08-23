import {
  CONTROL_CATEGORIES,
  GALAXY_QUERY_IDS,
  HOME_ROUTE,
  type InformationRoute,
  type PhoenixRoute,
  type PhoenixWorkspace
} from './phoenix-route.js'

type RawRouteQuery = Readonly<Record<string, string>>

export interface PhoenixRouter {
  getSnapshot(): PhoenixRoute
  getRememberedInformationRoute(): InformationRoute
  href(route: PhoenixRoute): string
  push(route: PhoenixRoute): void
  replace(route: PhoenixRoute): void
  routeForWorkspace(workspace: PhoenixWorkspace): PhoenixRoute
  subscribe(listener: () => void): () => void
}

export function parsePhoenixRoute(input: string): PhoenixRoute {
  const { segments, query } = splitHash(input)
  const [section, ...rest] = segments

  if (!section || section === 'home' || section === 'info') return HOME_ROUTE

  if (section === 'controls') {
    const category = CONTROL_CATEGORIES.find(candidate => candidate === rest[0]) ?? 'ship'
    return { kind: 'controls', category }
  }

  if (section === 'copilot') {
    return { kind: 'copilot', view: rest[0] === 'profiles' ? 'profiles' : 'chat' }
  }

  if (section === 'numpad' || section === 'telemetry') {
    return { kind: 'numpad' }
  }

  if (section === 'macros') return { kind: 'macros' }
  if (section === 'log' || section === 'journal' || (section === 'records' && ['journal', 'credits'].includes(rest[0] ?? ''))) {
    const view = section === 'records' && rest[0] === 'credits' ? 'credits' : 'journal'
    return { kind: 'journal', view }
  }

  if (section === 'exploration' || (section === 'records' && rest[0] === 'exploration')) {
    const systemName = query.system?.trim()
    const selectedName = query.body?.trim()
    if (systemName) return {
      kind: 'information',
      section: 'galaxy',
      view: 'system',
      systemName,
      ...(selectedName ? { selectedName } : {})
    }
    return { kind: 'information', section: 'galaxy', view: 'database', selectedQueryId: 'exploration-targets' }
  }

  if (section === 'developer') {
    const view = oneOf(rest[0], ['overview', 'runtime', 'elite', 'health', 'tests', 'controls'] as const) ?? 'overview'
    return { kind: 'developer', view }
  }

  if (section === 'settings') {
    return { kind: 'settings', view: rest[0] === 'help' ? 'help' : 'dashboard' }
  }

  if (section === 'ship') {
    if (rest[0] === 'inventory') return { kind: 'information', section: 'commander', view: 'inventory' }
    const view = rest[0] === 'modules' ? 'current-loadout' : rest[0] === 'cargo' ? 'current-cargo' : 'current-overview'
    return { kind: 'information', section: 'fleet', view }
  }

  if (section === 'navigation') return parseGalaxyRoute(rest, query)

  if (section === 'commander') {
    const view = oneOf(rest[0], ['overview', 'inventory', 'progress'] as const) ?? 'overview'
    return { kind: 'information', section, view }
  }

  if (section === 'fleet') return parseFleetRoute(rest, query)
  if (section === 'galaxy') return parseGalaxyRoute(rest, query)

  if (section === 'activities' || section === 'operations') {
    const view = oneOf(rest[0], ['missions', 'objectives', 'community-goals', 'powerplay', 'colonisation'] as const) ?? 'missions'
    return { kind: 'information', section: 'activities', view }
  }

  if (section === 'engineering') return parseEngineeringRoute(rest, query)

  if (section === 'comms') {
    const view = oneOf(rest[0], ['overview', 'inbox', 'traffic', 'contacts', 'galnet', 'radio'] as const) ?? 'overview'
    return { kind: 'information', section, view }
  }

  return HOME_ROUTE
}

export function phoenixRouteHash(route: PhoenixRoute): string {
  let path: string
  switch (route.kind) {
    case 'information': path = informationPath(route); break
    case 'controls': path = `/controls/${route.category}`; break
    case 'copilot': path = `/copilot/${route.view}`; break
    case 'numpad': path = '/numpad'; break
    case 'macros': path = '/macros'; break
    case 'journal': path = route.view === 'credits' ? '/records/credits' : '/records/journal'; break
    case 'developer': path = `/developer/${route.view}`; break
    case 'settings': path = route.view === 'help' ? '/settings/help' : '/settings'; break
  }
  const parameters = new URLSearchParams()
  if (route.kind === 'information' && route.section === 'galaxy' && route.view === 'system') {
    if (route.systemName) parameters.set('name', route.systemName)
    if (route.selectedName) parameters.set('selected', route.selectedName)
  }
  if (route.kind === 'information' && route.section === 'galaxy' && route.view === 'database' && route.selectedQueryId) {
    parameters.set('query', route.selectedQueryId)
  }
  if (route.kind === 'information' && route.section === 'fleet' && route.view === 'catalogue' && route.selectedShipId) {
    parameters.set('ship', route.selectedShipId)
  }
  if (route.kind === 'information' && route.section === 'engineering' && route.view === 'blueprints' && route.selectedBlueprintSymbol) {
    parameters.set('symbol', route.selectedBlueprintSymbol)
  }
  const query = parameters.toString()
  return `#${path}${query ? `?${query}` : ''}`
}

function informationPath(route: InformationRoute): string {
  if (route.section === 'home') return '/'
  if (route.section === 'fleet') {
    if (route.view === 'current-overview') return '/fleet/ships/current/overview'
    if (route.view === 'current-loadout') return '/fleet/ships/current/loadout'
    if (route.view === 'current-cargo') return '/fleet/ships/current/cargo'
    if (route.view === 'current-engineering') return '/fleet/ships/current/engineering'
    return `/fleet/${route.view}`
  }
  if (route.section === 'engineering' && route.view.startsWith('materials-')) {
    return `/engineering/materials/${route.view.slice('materials-'.length)}`
  }
  return `/${route.section}/${route.view}`
}

function parseFleetRoute(rest: string[], query: RawRouteQuery): InformationRoute {
  if (rest[0] === 'ships' && rest[1] === 'current') {
    const view = rest[2] === 'loadout' ? 'current-loadout' : rest[2] === 'cargo' ? 'current-cargo' : rest[2] === 'engineering' ? 'current-engineering' : 'current-overview'
    return { kind: 'information', section: 'fleet', view }
  }
  if (rest[0] === 'current' || rest[0] === 'loadout' || rest[0] === 'cargo' || rest[0] === 'engineering') {
    const view = rest[0] === 'loadout' ? 'current-loadout' : rest[0] === 'cargo' ? 'current-cargo' : rest[0] === 'engineering' ? 'current-engineering' : 'current-overview'
    return { kind: 'information', section: 'fleet', view }
  }
  const view = oneOf(rest[0], ['overview', 'carriers', 'stored-modules', 'catalogue'] as const) ?? 'overview'
  if (view === 'catalogue') {
    return {
      kind: 'information',
      section: 'fleet',
      view,
      ...(query.ship?.trim() ? { selectedShipId: query.ship.trim() } : {})
    }
  }
  return { kind: 'information', section: 'fleet', view }
}

function parseGalaxyRoute(rest: string[], query: RawRouteQuery): InformationRoute {
  const view = oneOf(rest[0], ['system', 'route', 'database'] as const) ?? 'system'
  if (view === 'system') {
    const { name, selected } = query
    return {
      kind: 'information',
      section: 'galaxy',
      view,
      ...(name?.trim() ? { systemName: name.trim() } : {}),
      ...(selected?.trim() ? { selectedName: selected.trim() } : {})
    }
  }
  if (view === 'database') {
    const selectedQueryId = GALAXY_QUERY_IDS.find(candidate => candidate === query.query?.trim())
    return {
      kind: 'information',
      section: 'galaxy',
      view,
      ...(selectedQueryId ? { selectedQueryId } : {})
    }
  }
  return { kind: 'information', section: 'galaxy', view }
}

function parseEngineeringRoute(rest: string[], query: RawRouteQuery): InformationRoute {
  if (rest[0] === 'materials') {
    const material = oneOf(rest[1], ['raw', 'manufactured', 'encoded', 'xeno'] as const) ?? 'raw'
    return { kind: 'information', section: 'engineering', view: `materials-${material}` }
  }
  const view = oneOf(rest[0], ['blueprints', 'engineers'] as const) ?? 'blueprints'
  if (view === 'blueprints') {
    return {
      kind: 'information',
      section: 'engineering',
      view,
      ...(query.symbol?.trim() ? { selectedBlueprintSymbol: query.symbol.trim() } : {})
    }
  }
  return { kind: 'information', section: 'engineering', view }
}

function splitHash(input: string): { segments: string[], query: RawRouteQuery } {
  const raw = input.trim().replace(/^#/u, '')
  const [path = '', search = ''] = raw.split('?', 2)
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return {
    segments: normalizedPath.split('/').filter(Boolean),
    query: Object.fromEntries(new URLSearchParams(search))
  }
}

function oneOf<const T extends readonly string[]>(value: string | undefined, values: T): T[number] | undefined {
  return values.find(candidate => candidate === value)
}
