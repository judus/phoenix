import { act, create } from 'react-test-renderer'
import { createEmptyRuntimeState, type CartographicSystem } from '@phoenix/contracts'
import { beforeAll, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixRoute } from '../apps/web/src/application/navigation/phoenix-route.js'
import { GalaxyPage } from '../apps/web/src/features/galaxy/galaxy-page.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('system schematic follow control pins the displayed system and resumes the current system', async () => {
  const onNavigate = vi.fn<(route: PhoenixRoute) => void>()
  const system = emptySystem('Sol')
  const runtimeState = createEmptyRuntimeState()
  runtimeState.system.name = 'Sol'
  const common = {
    api: {} as PhoenixApi,
    controller: { lookup: { cache: 'local' as const, system }, status: 'ready' as const },
    onNavigate,
    runtime: { state: runtimeState, status: 'ready' as const }
  }
  let renderer: ReturnType<typeof create>

  await act(async () => {
    renderer = create(<GalaxyPage {...common} route={{ kind: 'information', section: 'galaxy', view: 'system' }} />)
  })
  const following = renderer.root.findByProps({ 'aria-pressed': true })
  expect(following.props.children).toEqual(['Follow ', 'on'])
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
  const pinned = renderer.root.findByProps({ 'aria-pressed': false })
  expect(pinned.props.children).toEqual(['Follow ', 'off'])
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
      api={{} as PhoenixApi}
      controller={{ lookup: { cache: 'local', system }, status: 'ready' }}
      onNavigate={onNavigate}
      route={{ kind: 'information', section: 'galaxy', view: 'system' }}
      runtime={{ state: runtimeState, status: 'ready' }}
    />)
  })
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Sol, G Star' }).props.onClick())
  expect(onNavigate).toHaveBeenLastCalledWith({
    kind: 'information', section: 'galaxy', view: 'system', selectedName: 'Sol'
  })

  await act(async () => renderer.update(<GalaxyPage
    api={{} as PhoenixApi}
    controller={{ lookup: { cache: 'local', system }, status: 'ready' }}
    onNavigate={onNavigate}
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
      api={{ plotEliteDestination } as unknown as PhoenixApi}
      controller={{ lookup: { cache: 'local', system: emptySystem('Achenar') }, status: 'ready' }}
      onNavigate={onNavigate}
      route={{ kind: 'information', section: 'galaxy', view: 'system', systemName: 'Achenar' }}
      runtime={{ state: createEmptyRuntimeState(), status: 'ready' }}
    />)
  })
  const plotButton = renderer.root.findAllByType('button').find(button => button.props.children === 'Plot Route')
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
      api={{} as PhoenixApi}
      controller={{ error: 'No cartography record found.', status: 'error' }}
      onNavigate={onNavigate}
      route={{ kind: 'information', section: 'galaxy', view: 'system', systemName: 'Unreported System' }}
      runtime={{ state: createEmptyRuntimeState(), status: 'ready' }}
    />)
  })

  expect(renderer.root.findByProps({ id: 'system-query-name' }).props.value).toBe('Unreported System')
  expect(renderer.root.findByProps({ 'aria-pressed': false }).props.children).toEqual(['Follow ', 'off'])
  const plotButton = renderer.root.findAllByType('button').find(button => button.props.children === 'Plot Route')
  expect(plotButton?.props.disabled).toBe(true)
  const bookmarkButton = renderer.root.findAllByType('button').find(button => button.props.children === 'Bookmark')
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
