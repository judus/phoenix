import { act, create } from 'react-test-renderer'
import { createEmptyRuntimeState, type CartographicSystem } from '@phoenix/contracts'
import { beforeAll, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixRoute } from '../apps/web/src/application/navigation/phoenix-route.js'
import { GalaxyPage } from '../apps/web/src/features/galaxy/galaxy-page.js'
import { GalaxyQuerySessionStore } from '../apps/web/src/features/galaxy/galaxy-query-session-store.js'
import { galaxyContextForRoute, galaxyNavigationItems } from '../apps/web/src/features/galaxy/galaxy-navigation.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test.each([undefined, 'yes', 'no'])('commodity markets restores carrier preference %s and allows changing it', async fleetCarriers => {
  const savedQuery = {
    id: '00000000-0000-4000-8000-000000000002', name: 'Modular Terminals',
    createdAt: '2026-09-11T10:00:00.000Z', updatedAt: '2026-09-11T10:00:00.000Z',
    parameters: { origin: 'Sirius', originMode: 'fixed', commodity: 'ModularTerminals', intent: 'buy', ...(fleetCarriers ? { fleetCarriers } : {}) },
    queryId: 'commodity-markets', schemaVersion: 2, useOnDashboard: false
  }
  const execute = vi.fn().mockRejectedValue(new Error('Fixture'))
  const sessions = new GalaxyQuerySessionStore()
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<GalaxyPage
    api={{ findGalaxyCommodityMarkets: execute, getSavedGalaxyQueries: async () => ({ queries: [savedQuery] }) } as unknown as PhoenixApi}
    controller={{ status: 'idle' }} onNavigate={vi.fn()} querySessions={sessions}
    route={{ kind: 'information', section: 'galaxy', view: 'database', selectedQueryId: 'commodity-markets', savedQueryId: savedQuery.id }}
    runtime={{ state: createEmptyRuntimeState(), status: 'ready' }}
  />) })
  const select = () => renderer.root.findByProps({ id: 'query-fleetCarriers' })
  expect(select().props.value).toBe(fleetCarriers ?? 'no')
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  expect(execute).toHaveBeenLastCalledWith(expect.objectContaining({ commodity: 'ModularTerminals', intent: 'buy', fleetCarriers: fleetCarriers === 'yes' }))
  const changed = fleetCarriers === 'yes' ? 'no' : 'yes'
  await act(async () => select().props.onChange({ target: { value: changed } }))
  expect(select().props.value).toBe(changed)
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  expect(execute).toHaveBeenLastCalledWith(expect.objectContaining({ fleetCarriers: changed === 'yes' }))
  await act(async () => renderer.unmount())
})

test.each([
  ['shipyards', 'hull', 'Cobra MkIII', 'findGalaxyShipyards', 'hullName'],
  ['outfitting-stock', 'module', '5H Guardian FSD Booster', 'findGalaxyOutfitting', 'module'],
  ['commodity-markets', 'commodity', 'AdvancedCatalysers', 'findGalaxyCommodityMarkets', 'commodity']
] as const)('saved %s text remains executable without selecting a suggestion', async (queryId, field, value, method, argument) => {
  const savedQuery = {
    id: '00000000-0000-4000-8000-000000000002', name: 'Existing query',
    createdAt: '2026-09-11T10:00:00.000Z', updatedAt: '2026-09-11T10:00:00.000Z',
    parameters: { origin: 'Sol', originMode: 'fixed', [field]: value },
    queryId, schemaVersion: 2, useOnDashboard: false
  }
  const execute = vi.fn().mockRejectedValue(new Error('Fixture'))
  const suggestions = vi.fn()
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<GalaxyPage
    api={{ [method]: execute, getCatalogueSuggestions: suggestions, getSavedGalaxyQueries: async () => ({ queries: [savedQuery] }) } as unknown as PhoenixApi}
    controller={{ status: 'idle' }} onNavigate={vi.fn()} querySessions={new GalaxyQuerySessionStore()}
    route={{ kind: 'information', section: 'galaxy', view: 'database', selectedQueryId: queryId, savedQueryId: savedQuery.id }}
    runtime={{ state: createEmptyRuntimeState(), status: 'ready' }}
  />) })
  expect(renderer.root.findAllByType('input').find(node => node.props.role === 'combobox')!.props.value).toBe(value)
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  expect(execute).toHaveBeenCalledWith(expect.objectContaining({ [argument]: value }))
  expect(suggestions).not.toHaveBeenCalled()
  await act(async () => renderer.unmount())
})

test('faction state search accepts multiple states without a faction name', async () => {
  const findGalaxyFactionPresences = vi.fn().mockRejectedValue(new Error('Fixture'))
  const state = createEmptyRuntimeState()
  state.system.name = 'Sol'
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<GalaxyPage
    api={{ findGalaxyFactionPresences } as unknown as PhoenixApi}
    controller={{ status: 'idle' }} onNavigate={vi.fn()} querySessions={new GalaxyQuerySessionStore()}
    route={{ kind: 'information', section: 'galaxy', view: 'database', selectedQueryId: 'faction-presence' }}
    runtime={{ state, status: 'ready' }}
  />) })
  expect(renderer.root.findByProps({ id: 'query-faction' }).props.required).not.toBe(true)
  await act(async () => renderer.root.findAllByProps({ id: 'query-states' }).find(node => typeof node.props.onChange === 'function')!.props.onChange(['War', 'Civil War']))
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  expect(findGalaxyFactionPresences).toHaveBeenCalledWith(expect.objectContaining({
    factionName: undefined, states: ['War', 'Civil War'], controlling: 'any', systemName: 'Sol'
  }))
  await act(async () => renderer.unmount())
})

test('legacy saved faction state becomes a selected state in the new editor', async () => {
  const savedQuery = {
    id: '00000000-0000-4000-8000-000000000001', name: 'Old war query',
    createdAt: '2026-09-11T10:00:00.000Z', updatedAt: '2026-09-11T10:00:00.000Z',
    parameters: { origin: 'Sol', faction: 'Test faction', state: 'War' },
    queryId: 'faction-presence', schemaVersion: 2, useOnDashboard: false
  }
  const findGalaxyFactionPresences = vi.fn().mockRejectedValue(new Error('Fixture'))
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<GalaxyPage
    api={{ findGalaxyFactionPresences, getSavedGalaxyQueries: async () => ({ queries: [savedQuery] }) } as unknown as PhoenixApi}
    controller={{ status: 'idle' }} onNavigate={vi.fn()} querySessions={new GalaxyQuerySessionStore()}
    route={{ kind: 'information', section: 'galaxy', view: 'database', selectedQueryId: 'faction-presence', savedQueryId: savedQuery.id }}
    runtime={{ state: createEmptyRuntimeState(), status: 'ready' }}
  />) })
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  expect(findGalaxyFactionPresences).toHaveBeenCalledWith(expect.objectContaining({
    factionName: 'Test faction', states: ['War'], systemName: 'Sol'
  }))
  await act(async () => renderer.unmount())
})

test('reference toggle follows live telemetry, typing fixes it, and missing telemetry never reuses a stale origin', async () => {
  // Keep the editor open after each request so the same mounted form can follow telemetry.
  const findGalaxySystems = vi.fn().mockRejectedValue(new Error('Fixture response unavailable'))
  const state = createEmptyRuntimeState()
  state.system.name = 'Sol'
  const sessions = new GalaxyQuerySessionStore()
  const common = { api: { findGalaxySystems } as unknown as PhoenixApi, controller: { status: 'idle' as const }, onNavigate: vi.fn(), querySessions: sessions, route: { kind: 'information', section: 'galaxy', view: 'database', selectedQueryId: 'system-search' } as const }
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<GalaxyPage {...common} runtime={{ state, status: 'ready' }} />) })
  const submit = async () => act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault() {} }))
  const updateSystem = async (name: string | null) => act(async () => renderer.update(<GalaxyPage {...common} runtime={{ state: { ...state, system: { ...state.system, name } }, status: 'ready' }} />))
  await updateSystem('Achenar')
  expect(renderer.root.findByProps({ id: 'query-origin' }).props.placeholder).toBe('Achenar')
  await submit()
  expect(findGalaxySystems).toHaveBeenLastCalledWith(expect.objectContaining({ system: 'Achenar' }))
  await act(async () => renderer.root.findByProps({ id: 'query-origin' }).props.onChange({ target: { value: 'Colonia' } }))
  expect(renderer.root.findByProps({ 'aria-label': 'Follow current system' }).props['aria-pressed']).toBe(false)
  await updateSystem('Alioth')
  await submit()
  expect(findGalaxySystems).toHaveBeenLastCalledWith(expect.objectContaining({ system: 'Colonia' }))
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Follow current system' }).props.onClick())
  expect(sessions.get('system-search')?.values).toMatchObject({ origin: '', originMode: 'current' })
  await submit()
  expect(findGalaxySystems).toHaveBeenLastCalledWith(expect.objectContaining({ system: 'Alioth' }))
  await updateSystem(null)
  await submit()
  expect(findGalaxySystems).toHaveBeenCalledTimes(3)
  expect(JSON.stringify(renderer.toJSON())).toContain('Current system is unavailable')
  await act(async () => renderer.unmount())
})

test('system search uses one query form for nearby and filtered searches', async () => {
  const findGalaxySystems = vi.fn().mockResolvedValue({
    cache: 'fresh',
    filters: {
      allegiance: null,
      economy: null,
      government: null,
      maxDistanceLy: 100,
      maxPopulation: null,
      minPopulation: null,
      population: 'inhabited',
      security: null
    },
    originSystem: 'Sol',
    systems: [{
      allegiance: 'Federation',
      controllingFaction: 'Mother Gaia',
      distanceLy: 4.37,
      economy: 'High Tech',
      government: 'Democracy',
      inhabited: true,
      permitRequired: false,
      population: 230000,
      position: [3.03125, -0.09375, 3.15625],
      primaryStarClass: 'G (White-Yellow) Star',
      secondaryEconomy: 'Service',
      security: 'High',
      systemAddress: 1178707802194,
      systemName: 'Alpha Centauri',
      updatedAt: '2026-08-15T08:00:00.000Z'
    }]
  })
  const runtimeState = createEmptyRuntimeState()
  runtimeState.system.name = 'Sol'
  const querySessions = new GalaxyQuerySessionStore()
  let renderer: ReturnType<typeof create>

  await act(async () => {
    renderer = create(<GalaxyPage
      api={{ findGalaxySystems } as unknown as PhoenixApi}
      controller={{ status: 'idle' }}
      onNavigate={vi.fn()}
      querySessions={querySessions}
      route={{ kind: 'information', section: 'galaxy', view: 'database', selectedQueryId: 'system-search' }}
      runtime={{ state: runtimeState, status: 'ready' }}
    />)
  })

  expect(renderer.root.findByProps({ id: 'query-origin' }).props.value).toBe('')
  expect(renderer.root.findByProps({ id: 'query-origin' }).props.placeholder).toBe('Sol')
  await act(async () => renderer.root.findByProps({ id: 'query-population' }).props.onChange({ target: { value: 'inhabited' } }))
  await act(async () => renderer.root.findByType('form').props.onSubmit({ preventDefault: vi.fn() }))

  expect(findGalaxySystems).toHaveBeenCalledWith(expect.objectContaining({
    maxDistance: 100,
    population: 'inhabited',
    system: 'Sol'
  }))
  const sortableHeaders = renderer.root.findAll(node => node.type === 'th' && node.props.className?.includes('sortable'))
  expect(sortableHeaders.map(header => header.findByProps({ className: 'sort-heading' }).children.join(''))).toEqual([
    'System',
    'Distance',
    'Economy',
    'Government',
    'Security',
    'Population',
    'Reported'
  ])
  expect(renderer.root.findAll(node => node.children.includes('Alpha Centauri'))).not.toHaveLength(0)
  await act(async () => renderer.unmount())

  await act(async () => {
    renderer = create(<GalaxyPage
      api={{ findGalaxySystems } as unknown as PhoenixApi}
      controller={{ status: 'idle' }}
      onNavigate={vi.fn()}
      querySessions={querySessions}
      route={{ kind: 'information', section: 'galaxy', view: 'database', selectedQueryId: 'system-search' }}
      runtime={{ state: runtimeState, status: 'ready' }}
    />)
  })
  expect(renderer.root.findAll(node => node.children.includes('Alpha Centauri'))).not.toHaveLength(0)
  expect(renderer.root.findAllByType('form')).toHaveLength(0)
  expect(findGalaxySystems).toHaveBeenCalledTimes(1)
  await act(async () => renderer.unmount())
})

test('saved queries run fresh with their stored parameters', async () => {
  const savedQuery = {
    createdAt: '2026-09-11T10:00:00.000Z',
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Nearby inhabited systems',
    parameters: { origin: 'Sol', population: 'inhabited', radius: '50' },
    queryId: 'system-search' as const,
    schemaVersion: 2 as const,
    updatedAt: '2026-09-11T10:00:00.000Z',
    useOnDashboard: false
  }
  const getSavedGalaxyQueries = vi.fn().mockResolvedValue({ queries: [savedQuery] })
  const findGalaxySystems = vi.fn().mockResolvedValue({
    cache: 'fresh',
    filters: { allegiance: null, economy: null, government: null, maxDistanceLy: 50, maxPopulation: null, minPopulation: null, population: 'inhabited', security: null },
    originSystem: 'Sol',
    systems: []
  })
  const api = { findGalaxySystems, getSavedGalaxyQueries } as unknown as PhoenixApi
  const onNavigate = vi.fn<(route: PhoenixRoute) => void>()
  const common = {
    api,
    controller: { status: 'idle' as const },
    onNavigate,
    querySessions: new GalaxyQuerySessionStore(),
    runtime: { state: createEmptyRuntimeState(), status: 'ready' as const }
  }
  let renderer: ReturnType<typeof create>

  await act(async () => {
    renderer = create(<GalaxyPage {...common} route={{ kind: 'information', section: 'galaxy', view: 'saved-queries' }} />)
  })
  expect(renderer.root.findAll(node => node.children.includes('Nearby inhabited systems'))).not.toHaveLength(0)
  await act(async () => renderer.root.findAllByType('button').find(button => button.props.children === 'Run')!.props.onClick())
  expect(onNavigate).toHaveBeenLastCalledWith({
    kind: 'information',
    savedQueryId: savedQuery.id,
    savedQueryRunId: expect.any(String),
    section: 'galaxy',
    selectedQueryId: 'system-search',
    view: 'database'
  })

  const runRoute = onNavigate.mock.calls.at(-1)![0]
  await act(async () => renderer.update(<GalaxyPage
    {...common}
    route={runRoute as Extract<PhoenixRoute, { kind: 'information', section: 'galaxy' }>}
  />))
  expect(findGalaxySystems).toHaveBeenCalledWith(expect.objectContaining({ maxDistance: 50, population: 'inhabited', system: 'Sol' }))
  expect(renderer.root.findAll(node => node.children.includes('Query results'))).not.toHaveLength(0)
  expect(renderer.root.findAllByType('form')).toHaveLength(0)

  await act(async () => renderer.update(<GalaxyPage {...common} route={{ kind: 'information', section: 'galaxy', view: 'database' }} />))
  await act(async () => renderer.update(<GalaxyPage
    {...common}
    route={runRoute as Extract<PhoenixRoute, { kind: 'information', section: 'galaxy' }>}
  />))
  expect(findGalaxySystems).toHaveBeenCalledTimes(1)

  await act(async () => renderer.update(<GalaxyPage {...common} route={{ kind: 'information', section: 'galaxy', view: 'saved-queries' }} />))
  await act(async () => renderer.root.findAllByType('button').find(button => button.props.children === 'Run')!.props.onClick())
  const nextRunRoute = onNavigate.mock.calls.at(-1)![0]
  expect(nextRunRoute).not.toEqual(runRoute)
  await act(async () => renderer.update(<GalaxyPage
    {...common}
    route={nextRunRoute as Extract<PhoenixRoute, { kind: 'information', section: 'galaxy' }>}
  />))
  expect(findGalaxySystems).toHaveBeenCalledTimes(2)
  // A deck shortcut can run again while the information workspace stays mounted.
  getSavedGalaxyQueries.mockResolvedValue({ queries: [{ ...savedQuery, parameters: { ...savedQuery.parameters, originMode: 'current', origin: '', radius: '75' } }] })
  await act(async () => renderer.update(<GalaxyPage
    {...common}
    runtime={{ status: 'ready', state: { ...createEmptyRuntimeState(), system: { ...createEmptyRuntimeState().system, name: 'Achenar' } } }}
    route={{ kind: 'information', section: 'galaxy', view: 'database', selectedQueryId: 'system-search', savedQueryId: savedQuery.id, savedQueryRunId: 'shortcut-run-3' }}
  />))
  expect(findGalaxySystems).toHaveBeenCalledTimes(3)
  expect(findGalaxySystems).toHaveBeenLastCalledWith(expect.objectContaining({ system: 'Achenar', maxDistance: 75 }))
  await act(async () => renderer.unmount())
})

test('Saved Queries owns a dedicated Galaxy rail destination', () => {
  expect(galaxyNavigationItems.at(-1)).toMatchObject({
    href: '#/galaxy/saved-queries',
    id: 'saved-queries',
    label: 'Saved queries',
    shortLabel: 'SVQ'
  })
  expect(galaxyContextForRoute({ kind: 'information', section: 'galaxy', view: 'saved-queries' })).toBe('saved-queries')
})

test('a configured query can be saved as a durable definition', async () => {
  const saved = {
    createdAt: '2026-09-11T10:00:00.000Z',
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Systems near Sol',
    parameters: { origin: 'Sol', radius: '100' },
    queryId: 'system-search' as const,
    schemaVersion: 2 as const,
    updatedAt: '2026-09-11T10:00:00.000Z',
    useOnDashboard: false
  }
  const saveGalaxyQuery = vi.fn().mockResolvedValue(saved)
  const onNavigate = vi.fn<(route: PhoenixRoute) => void>()
  let renderer: ReturnType<typeof create>

  await act(async () => {
    renderer = create(<GalaxyPage
      api={{ saveGalaxyQuery } as unknown as PhoenixApi}
      controller={{ status: 'idle' }}
      onNavigate={onNavigate}
      querySessions={new GalaxyQuerySessionStore()}
      route={{ kind: 'information', section: 'galaxy', selectedQueryId: 'system-search', view: 'database' }}
      runtime={{ state: createEmptyRuntimeState(), status: 'ready' }}
    />)
  })
  await act(async () => renderer.root.findAllByType('button').find(button => button.props.children === 'Save query')!.props.onClick())
  await act(async () => renderer.root.findByProps({ id: 'saved-query-name' }).props.onChange({ target: { value: 'Systems near Sol' } }))
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Save query' }).props.onClick())

  expect(saveGalaxyQuery).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Systems near Sol',
    parameters: expect.objectContaining({ origin: '', originMode: 'current' }),
    queryId: 'system-search'
  }), undefined)
  expect(onNavigate).toHaveBeenLastCalledWith({
    kind: 'information',
    savedQueryId: saved.id,
    section: 'galaxy',
    selectedQueryId: 'system-search',
    view: 'database'
  })
  await act(async () => renderer.unmount())
})

test('system schematic follow control pins the displayed system and resumes the current system', async () => {
  const onNavigate = vi.fn<(route: PhoenixRoute) => void>()
  const system = emptySystem('Sol')
  const runtimeState = createEmptyRuntimeState()
  runtimeState.system.name = 'Sol'
  const common = {
    api: galaxyApi(),
    controller: { lookup: { cache: 'local' as const, system }, status: 'ready' as const },
    onNavigate,
    querySessions: new GalaxyQuerySessionStore(),
    runtime: { state: runtimeState, status: 'ready' as const }
  }
  let renderer: ReturnType<typeof create>

  await act(async () => {
    renderer = create(<GalaxyPage {...common} route={{ kind: 'information', section: 'galaxy', view: 'system' }} />)
  })
  const following = renderer.root.findByProps({ 'aria-label': 'Stop following current system' })
  expect(following.props['aria-pressed']).toBe(true)
  await act(async () => following.props.onClick())
  expect(onNavigate).toHaveBeenLastCalledWith({
    kind: 'information', section: 'galaxy', view: 'system', systemName: 'Sol'
  })

  await act(async () => {
    renderer.update(<GalaxyPage
      {...common}
      route={{ kind: 'information', section: 'galaxy', view: 'system', systemName: 'Achenar' }}
    />)
  })
  const pinned = renderer.root.findByProps({ 'aria-label': 'Follow current system' })
  expect(pinned.props['aria-pressed']).toBe(false)
  await act(async () => pinned.props.onClick())
  expect(onNavigate).toHaveBeenLastCalledWith({ kind: 'information', section: 'galaxy', view: 'system' })

  await act(async () => renderer.unmount())
})

test('selecting a body does not pin a schematic that is following the current system', async () => {
  const onNavigate = vi.fn<(route: PhoenixRoute) => void>()
  const system = emptySystem('Sol')
  system.bodies = [{
    bodyId: 0,
    details: {
      absoluteMagnitude: null, ageMillionYears: null, atmosphereComposition: [], isMainStar: null, isScoopable: null,
      luminosity: null, massEarths: null, materials: [], orbit: { ascendingNodeDegrees: null, axialTiltDegrees: null, eccentricity: null, inclinationDegrees: null, meanAnomalyDegrees: null, orbitalPeriodSeconds: null, periapsisDegrees: null, rotationPeriodSeconds: null, semiMajorAxisKilometres: null },
      reserveLevel: null, rings: [], scanType: null, solarMasses: null, solarRadius: null, solidComposition: null,
      spectralClass: null, starSubclass: null, surfacePressurePascals: null, terraformState: null, tidallyLocked: null, volcanism: null
    },
    distanceToArrival: 0,
    firstDiscoveredBy: null,
    firstFootfallBy: null,
    firstMappedBy: null,
    gravityGs: null,
    id: 0,
    id64: 1,
    landable: null,
    local: null,
    name: 'Sol',
    parents: [],
    radiusKilometres: null,
    raw: {},
    ringed: false,
    subType: 'G Star',
    surfaceTemperatureKelvin: null,
    atmosphere: null,
    type: 'Star'
  }]
  const runtimeState = createEmptyRuntimeState()
  runtimeState.system.name = 'Sol'
  let renderer: ReturnType<typeof create>

  await act(async () => {
    renderer = create(<GalaxyPage
      api={galaxyApi()}
      controller={{ lookup: { cache: 'local', system }, status: 'ready' }}
      onNavigate={onNavigate}
      querySessions={new GalaxyQuerySessionStore()}
      route={{ kind: 'information', section: 'galaxy', view: 'system' }}
      runtime={{ state: runtimeState, status: 'ready' }}
    />)
  })
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Sol, G Star' }).props.onClick())
  expect(onNavigate).toHaveBeenLastCalledWith({
    kind: 'information', section: 'galaxy', view: 'system', selectedName: 'Sol'
  })

  await act(async () => renderer.update(<GalaxyPage
    api={galaxyApi()}
    controller={{ lookup: { cache: 'local', system }, status: 'ready' }}
    onNavigate={onNavigate}
    querySessions={new GalaxyQuerySessionStore()}
    route={{ kind: 'information', section: 'galaxy', view: 'system', selectedName: 'Sol' }}
    runtime={{ state: runtimeState, status: 'ready' }}
  />))
  const bookmarkBody = renderer.root.findAllByType('button').find(button => button.props.children === 'Bookmark body')
  await act(async () => bookmarkBody!.props.onClick())
  expect(onNavigate).toHaveBeenLastCalledWith({
    bodyName: 'Sol', kind: 'information', section: 'galaxy', systemName: 'Sol', view: 'bookmarks'
  })

  await act(async () => renderer.unmount())
})

test('system schematic submits its displayed system to Elite and shows confirmed route evidence', async () => {
  const plotEliteDestination = vi.fn().mockResolvedValue({
    requestedSystem: 'Achenar',
    confirmedSystem: 'Achenar',
    status: 'confirmed',
    phase: 'confirm_route',
    message: 'Route to Achenar was confirmed.'
  })
  const onNavigate = vi.fn()
  let renderer: ReturnType<typeof create>

  await act(async () => {
    renderer = create(<GalaxyPage
      api={galaxyApi({ plotEliteDestination })}
      controller={{ lookup: { cache: 'local', system: emptySystem('Achenar') }, status: 'ready' }}
      onNavigate={onNavigate}
      querySessions={new GalaxyQuerySessionStore()}
      route={{ kind: 'information', section: 'galaxy', view: 'system', systemName: 'Achenar' }}
      runtime={{ state: createEmptyRuntimeState(), status: 'ready' }}
    />)
  })
  const plotButton = renderer.root.findAllByType('button').find(button => button.props['aria-label'] === 'Plot route')
  expect(plotButton).toBeDefined()

  await act(async () => plotButton!.props.onClick())

  expect(plotEliteDestination).toHaveBeenCalledWith('Achenar', expect.any(AbortSignal))
  expect(onNavigate).toHaveBeenCalledWith({ kind: 'information', section: 'galaxy', view: 'route' })
  expect(renderer.root.findAll(node => node.children.includes('Route to Achenar was confirmed.'))).not.toHaveLength(0)
  await act(async () => renderer.unmount())
})

test('system schematic keeps its navigation controls when cartography is unavailable', async () => {
  const onNavigate = vi.fn<(route: PhoenixRoute) => void>()
  let renderer: ReturnType<typeof create>

  await act(async () => {
    renderer = create(<GalaxyPage
      api={galaxyApi()}
      controller={{ error: 'No cartography record found.', status: 'error' }}
      onNavigate={onNavigate}
      querySessions={new GalaxyQuerySessionStore()}
      route={{ kind: 'information', section: 'galaxy', view: 'system', systemName: 'Unreported System' }}
      runtime={{ state: createEmptyRuntimeState(), status: 'ready' }}
    />)
  })

  expect(renderer.root.findByProps({ id: 'system-query-name' }).props.value).toBe('Unreported System')
  expect(renderer.root.findByProps({ 'aria-label': 'Follow current system' }).props['aria-pressed']).toBe(false)
  const plotButton = renderer.root.findAllByType('button').find(button => button.props['aria-label'] === 'Plot route')
  expect(plotButton?.props.disabled).toBe(true)
  const bookmarkButton = renderer.root.findAllByType('button').find(button => button.props['aria-label'] === 'Bookmark Unreported System')
  expect(bookmarkButton?.props.disabled).toBe(false)
  await act(async () => bookmarkButton!.props.onClick())
  expect(onNavigate).toHaveBeenLastCalledWith({
    kind: 'information', section: 'galaxy', view: 'bookmarks', systemName: 'Unreported System'
  })
  expect(renderer.root.findAll(node => node.children.includes('No cartography record found.'))).not.toHaveLength(0)

  await act(async () => renderer.unmount())
})

function emptySystem(name: string): CartographicSystem {
  return {
    address: null,
    bodies: [],
    information: {
      allegiance: null, controllingFaction: null, government: null, population: null,
      primaryEconomy: null, secondaryEconomy: null, security: null, state: null
    },
    localSystem: null,
    name,
    permitName: null,
    permitRequired: false,
    position: null,
    primaryStar: null,
    provenance: { edsm: null, journal: null },
    raw: { bodies: {}, stations: {}, system: {} },
    scanProgress: { knownBodies: 0, percent: null, reportedBodies: null },
    schemaVersion: 5,
    stations: []
  }
}

function galaxyApi(overrides: Partial<PhoenixApi> = {}): PhoenixApi {
  return {
    getGalaxyBookmarks: vi.fn().mockResolvedValue({ bookmarks: [] }),
    ...overrides
  } as unknown as PhoenixApi
}

test.each(['result', 'network'])('route plotting %s failure opens a help-linked popover instead of inline error text', async kind => {
  const showPopover = vi.fn()
  const plotEliteDestination = kind === 'network'
    ? vi.fn().mockRejectedValue(new Error('Connection lost.'))
    : vi.fn().mockImplementation(async () => ({
      requestedSystem: 'Sol', confirmedSystem: null, status: 'timed_out', phase: 'confirm_route',
      message: 'Elite did not confirm a newly plotted route to Sol.',
      bindingWarnings: ['Missing keyboard binding: UI_Right.']
    }))
  const onNavigate = vi.fn()
  let renderer: ReturnType<typeof create>
  await act(async () => {
    renderer = create(<GalaxyPage
      api={galaxyApi({ plotEliteDestination })}
      controller={{ lookup: { cache: 'local', system: emptySystem('Sol') }, status: 'ready' }}
      onNavigate={onNavigate}
      querySessions={new GalaxyQuerySessionStore()}
      route={{ kind: 'information', section: 'galaxy', view: 'system', systemName: 'Sol' }}
      runtime={{ state: createEmptyRuntimeState(), status: 'ready' }}
    />, { createNodeMock: element => element.props.popover ? { showPopover } : null })
  })
  const plot = () => renderer.root.findAllByType('button').find(button => button.props['aria-label'] === 'Plot route')!
  await act(async () => plot().props.onClick())
  expect(showPopover).toHaveBeenCalledTimes(1)
  expect(onNavigate).not.toHaveBeenCalled()
  const popover = renderer.root.findByProps({ role: 'dialog' })
  expect(popover.props.popover).toBe('auto')
  expect(popover.findByType('a').props.href).toBe('#/settings/help?topic=route-plotting')
  expect(popover.findByProps({ 'aria-label': 'Close route plotting error' }).props.popoverTargetAction).toBe('hide')
  expect(popover.findAllByType('li').map(item => item.children.join(''))).toEqual(kind === 'network' ? [] : ['Missing keyboard binding: UI_Right.'])
  expect(renderer.root.findAllByProps({ className: 'system-query__status' })).toHaveLength(0)
  await act(async () => plot().props.onClick())
  expect(showPopover).toHaveBeenCalledTimes(2)
  await act(async () => renderer.unmount())
})
