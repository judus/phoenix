import { AtlasDisplayLocationSchema, PersonalNoteTargetSchema } from '@phoenix/contracts'
import {
  GALAXY_QUERY_IDS,
  DEFAULT_ROUTE,
  type InformationRoute,
  type PhoenixRoute,
  type PhoenixWorkspace,
  type ControlDeckId
} from './phoenix-route.js'

type RawRouteQuery = Readonly<Record<string, string>>

export interface PhoenixRouter {
  getSnapshot(): PhoenixRoute
  getRememberedInformationRoute(): InformationRoute
  href(route: PhoenixRoute): string
  push(route: PhoenixRoute): void
  replace(route: PhoenixRoute): void
  routeForWorkspace(workspace: PhoenixWorkspace, firstControlDeckId?: ControlDeckId): PhoenixRoute
  subscribe(listener: () => void): () => void
}

export function parsePhoenixRoute(input: string): PhoenixRoute {
  const { segments, query } = splitHash(input)
  const [section, ...rest] = segments

  if (!section) return DEFAULT_ROUTE

  if (section === 'controls') {
    const deckId = rest[0] && /^[a-z][a-z0-9_-]{0,63}$/u.test(rest[0]) ? rest[0] : 'quick'
    return { kind: 'controls', deckId }
  }

  if (section === 'copilot') {
    return { kind: 'copilot', view: rest[0] === 'profiles' ? 'profiles' : 'chat' }
  }

  if (section === 'numpad' || section === 'telemetry') {
    return { kind: 'numpad' }
  }

  if (section === 'macros') return { kind: 'macros' }
  if (section === 'notes') {
    const candidate = query.mission !== undefined ? { kind: 'mission', missionId: query.mission.trim() ? Number(query.mission) : NaN }
      : query.station ? { kind: 'station', systemName: query.system, stationName: query.station }
        : query.body ? { kind: 'body', systemName: query.system, bodyName: query.body }
          : { kind: 'system', systemName: query.system }
    const target = PersonalNoteTargetSchema.safeParse(candidate)
    return { kind: 'notes', ...(query.edit ? { noteId: query.edit } : {}),
      ...(query.new === '1' ? { newNote: true } : {}), ...(target.success ? { target: target.data } : {}) }
  }
  if (section === 'log') return { kind: 'journal', view: rest[0] === 'credits' ? 'credits' : 'commander' }
  if (section === 'journal' || (section === 'records' && rest[0] === 'journal')) return { kind: 'developer', view: 'journal' }
  if (section === 'records' && rest[0] === 'credits') return { kind: 'journal', view: 'credits' }

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
    const legacyView = section === 'records' ? rest[1] : rest[0]
    if (legacyView === 'biology' || legacyView === 'ledger') {
      return { kind: 'information', section: 'galaxy', view: 'exobiology' }
    }
    return { kind: 'information', section: 'galaxy', view: 'database', selectedQueryId: 'exploration-targets' }
  }

  if (section === 'developer') {
    const view = oneOf(rest[0], ['journal', 'tools', 'eddn'] as const) ?? 'tools'
    return { kind: 'developer', view }
  }

  if (section === 'settings') {
    const view = oneOf(rest[0], ['general', 'pairing', 'copilot', 'help'] as const) ?? 'general'
    return { kind: 'settings', view, ...(view === 'help' && query.topic?.trim() ? { topic: query.topic.trim() } : {}) }
  }

  if (section === 'ship') {
    if (rest[0] === 'inventory') return { kind: 'information', section: 'commander', view: 'inventory' }
    const view = rest[0] === 'modules' ? 'current-loadout' : rest[0] === 'cargo' ? 'current-cargo' : 'current-overview'
    return { kind: 'information', section: 'fleet', view }
  }

  if (section === 'navigation') return parseGalaxyRoute(rest, query)

  if (section === 'commander') {
    const legacyCareer = rest[0] === 'overview' || rest[0] === 'progress'
    const view = legacyCareer
      ? 'career'
      : oneOf(rest[0], ['dashboard', 'career', 'statistics', 'inventory', 'loadouts'] as const) ?? 'dashboard'
    return { kind: 'information', section, view }
  }

  if (section === 'fleet') return parseFleetRoute(rest, query)
  if (section === 'galaxy') return parseGalaxyRoute(rest, query)

  if (section === 'activities' || section === 'operations') {
    const view = oneOf(rest[0], ['missions', 'objectives', 'community-goals', 'powerplay', 'colonisation'] as const) ?? 'missions'
    if (view === 'missions') {
      const id = query.mission?.trim() ? Number(query.mission) : NaN
      return { kind: 'information', section: 'activities', view,
        ...(Number.isSafeInteger(id) && id >= 0 ? { selectedMissionId: id } : {}) }
    }
    return { kind: 'information', section: 'activities', view }
  }

  if (section === 'engineering') return parseEngineeringRoute(rest, query)

  if (section === 'equipment') {
    const view = oneOf(rest[0], ['gear', 'planner', 'upgrades', 'specialists', 'materials'] as const) ?? 'gear'
    if (view === 'upgrades') return { kind: 'information', section, view, ...(query.id?.trim() ? { selectedUpgradeId: query.id.trim() } : {}) }
    if (view === 'specialists') return { kind: 'information', section, view, ...(query.id?.trim() ? { selectedSpecialistId: query.id.trim() } : {}) }
    return { kind: 'information', section, view }
  }

  if (section === 'comms') {
    const view = rest[0] === 'overview'
      ? 'inbox'
      : oneOf(rest[0], ['inbox', 'traffic', 'contacts', 'galnet', 'radio'] as const) ?? 'inbox'
    return { kind: 'information', section, view }
  }

  return DEFAULT_ROUTE
}

export function phoenixRouteHash(route: PhoenixRoute): string {
  let path: string
  switch (route.kind) {
    case 'information': path = informationPath(route); break
    case 'controls': path = `/controls/${route.deckId}`; break
    case 'copilot': path = `/copilot/${route.view}`; break
    case 'numpad': path = '/numpad'; break
    case 'macros': path = '/macros'; break
    case 'notes': path = '/notes'; break
    case 'journal': path = `/log/${route.view}`; break
    case 'developer': path = `/developer/${route.view}`; break
    case 'settings': path = `/settings/${route.view}`; break
  }
  const parameters = new URLSearchParams()
  if (route.kind === 'information' && route.section === 'activities' && route.view === 'missions' && route.selectedMissionId !== undefined) {
    parameters.set('mission', String(route.selectedMissionId))
  }
  if (route.kind === 'notes') {
    if (route.noteId) parameters.set('edit', route.noteId)
    if (route.newNote) parameters.set('new', '1')
    const target = route.target
    if (target?.kind === 'mission') parameters.set('mission', String(target.missionId))
    else if (target) {
      parameters.set('system', target.systemName)
      if (target.kind === 'station') parameters.set('station', target.stationName)
      if (target.kind === 'body') parameters.set('body', target.bodyName)
    }
  }
  if (route.kind === 'information' && route.section === 'galaxy' && route.view === 'atlas' && route.location) {
    parameters.set('name', route.location.systemName)
    parameters.set('position', route.location.position.join(','))
    if (route.displayRequestId) parameters.set('request', route.displayRequestId)
  }
  if (route.kind === 'settings' && route.view === 'help' && route.topic) parameters.set('topic', route.topic)
  if (route.kind === 'information' && route.section === 'galaxy' && route.view === 'system') {
    if (route.systemName) parameters.set('name', route.systemName)
    if (route.selectedName) parameters.set('selected', route.selectedName)
  }
  if (route.kind === 'information' && route.section === 'galaxy' && route.view === 'database' && route.selectedQueryId) {
    parameters.set('query', route.selectedQueryId)
    if (route.savedQueryId) parameters.set('saved', route.savedQueryId)
    if (route.savedQueryRunId) parameters.set('run', route.savedQueryRunId)
  }
  if (route.kind === 'information' && route.section === 'galaxy' && route.view === 'bookmarks') {
    if (route.bookmarkId) parameters.set('edit', route.bookmarkId)
    if (route.systemName) parameters.set('system', route.systemName)
    if (route.bodyName) parameters.set('body', route.bodyName)
    if (route.stationName) parameters.set('station', route.stationName)
  }
  if (route.kind === 'information' && route.section === 'fleet' && route.view === 'catalogue' && route.selectedShipId) {
    parameters.set('ship', route.selectedShipId)
  }
  if (route.kind === 'information' && route.section === 'engineering' && route.view === 'blueprints' && route.selectedBlueprintSymbol) {
    parameters.set('symbol', route.selectedBlueprintSymbol)
  }
  if (route.kind === 'information' && route.section === 'engineering' && route.view === 'experimental-effects' && route.selectedEffectSymbol) {
    parameters.set('symbol', route.selectedEffectSymbol)
  }
  if (route.kind === 'information' && route.section === 'engineering' && route.view === 'project-new' && route.selectedBlueprintSymbol) {
    parameters.set('blueprint', route.selectedBlueprintSymbol)
  }
  if (route.kind === 'information' && route.section === 'engineering' && route.view === 'project-add-blueprint') {
    parameters.set('blueprint', route.selectedBlueprintSymbol)
    if (route.selectedProjectId) parameters.set('project', route.selectedProjectId)
  }
  if (route.kind === 'information' && route.section === 'equipment' && route.view === 'upgrades' && route.selectedUpgradeId) {
    parameters.set('id', route.selectedUpgradeId)
  }
  if (route.kind === 'information' && route.section === 'equipment' && route.view === 'specialists' && route.selectedSpecialistId) {
    parameters.set('id', route.selectedSpecialistId)
  }
  const query = parameters.toString()
  return `#${path}${query ? `?${query}` : ''}`
}

function informationPath(route: InformationRoute): string {
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
  if (route.section === 'engineering') {
    if (route.view === 'project-new') return '/engineering/projects/new'
    if (route.view === 'project-detail') return `/engineering/projects/${route.selectedProjectId}`
    if (route.view === 'project-add-blueprint') return '/engineering/projects/add-blueprint'
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
  const view = oneOf(rest[0], ['system', 'atlas', 'route', 'database', 'saved-queries', 'exobiology', 'bookmarks'] as const) ?? (rest[0] ? 'system' : 'atlas')
  if (view === 'atlas') {
    const coordinates = query.position?.split(',')
    const parsed = AtlasDisplayLocationSchema.safeParse({
      systemName: query.name,
      position: coordinates?.map(value => value.trim() ? Number(value) : NaN)
    })
    return { kind: 'information', section: 'galaxy', view,
      ...(parsed.success ? { location: parsed.data, ...(query.request?.trim() ? { displayRequestId: query.request.trim() } : {}) } : {}) }
  }
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
    const savedQueryId = query.saved?.trim()
    return {
      kind: 'information',
      section: 'galaxy',
      view,
      ...(selectedQueryId ? { selectedQueryId } : {}),
      ...(selectedQueryId && savedQueryId ? { savedQueryId } : {}),
      ...(selectedQueryId && savedQueryId && query.run?.trim() ? { savedQueryRunId: query.run.trim() } : {})
    }
  }
  if (view === 'bookmarks') {
    return {
      kind: 'information',
      section: 'galaxy',
      view,
      ...(query.edit?.trim() ? { bookmarkId: query.edit.trim() } : {}),
      ...(query.system?.trim() ? { systemName: query.system.trim() } : {}),
      ...(query.station?.trim() ? { stationName: query.station.trim() } : query.body?.trim() ? { bodyName: query.body.trim() } : {})
    }
  }
  return { kind: 'information', section: 'galaxy', view }
}

function parseEngineeringRoute(rest: string[], query: RawRouteQuery): InformationRoute {
  if (rest[0] === 'materials') {
    const material = oneOf(rest[1], ['raw', 'manufactured', 'encoded', 'xeno'] as const) ?? 'raw'
    return { kind: 'information', section: 'engineering', view: `materials-${material}` }
  }
  if (rest[0] === 'projects') {
    if (rest[1] === 'new') {
      return {
        kind: 'information',
        section: 'engineering',
        view: 'project-new',
        ...(query.blueprint?.trim() ? { selectedBlueprintSymbol: query.blueprint.trim() } : {})
      }
    }
    if (rest[1] === 'add-blueprint') {
      return query.blueprint?.trim()
        ? {
            kind: 'information',
            section: 'engineering',
            view: 'project-add-blueprint',
            selectedBlueprintSymbol: query.blueprint.trim(),
            ...(query.project?.trim() ? { selectedProjectId: query.project.trim() } : {})
          }
        : { kind: 'information', section: 'engineering', view: 'projects' }
    }
    if (rest[1]) return { kind: 'information', section: 'engineering', view: 'project-detail', selectedProjectId: rest[1] }
    return { kind: 'information', section: 'engineering', view: 'projects' }
  }
  if (rest[0] === 'experimental-effects') return {
    kind: 'information', section: 'engineering', view: 'experimental-effects',
    ...(query.symbol?.trim() ? { selectedEffectSymbol: query.symbol.trim() } : {})
  }
  const view = oneOf(rest[0], ['projects', 'blueprints', 'engineers'] as const) ?? 'blueprints'
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
