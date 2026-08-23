import { renderToStaticMarkup } from 'react-dom/server'
import { act, create } from 'react-test-renderer'
import { createEmptyRuntimeState, type CartographyLookupResponse, type GameActionCatalogResponse, type NavigationRoute } from '@phoenix/contracts'
import { beforeAll, expect, test, vi } from 'vitest'
import { buildRouteLegs, PlottedRoute, type PlottedRouteProps } from '../apps/web/src/features/galaxy/plotted-route.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

const route: NavigationRoute = {
  timestamp: '2026-08-15T16:29:09.000Z',
  route: [
    { system: 'Sol', address: 1, position: [0, 0, 0], starClass: 'G' },
    { system: 'Alpha Centauri', address: 2, position: [3, 4, 0], starClass: 'G' },
    { system: 'Sirius', address: 3, position: [3, 4, 12], starClass: 'A' }
  ]
}

const actions: GameActionCatalogResponse = {
  actions: [{
    available: true,
    binding: { display: 'R', key: 'R', modifiers: [] },
    definition: {
      category: 'navigation',
      description: 'Target the next system in the plotted route.',
      eliteBinding: 'TargetNextRouteSystem',
      id: 'elite.TargetNextRouteSystem',
      inputMode: 'tap',
      label: 'Next Route System',
      risk: 'routine',
      telemetryKey: null
    },
    unavailableReason: null
  }],
  backend: { available: true, detail: 'Ready', id: 'test', simulated: false },
  bindingSource: {
    available: true,
    bindingCount: 1,
    directory: null,
    error: null,
    filePath: null,
    keyboardBindingCount: 1,
    loadedAt: null,
    presetNames: []
  }
}

const api = {
  executeAction: vi.fn(async () => ({
    actionId: 'elite.TargetNextRouteSystem',
    correlationId: 'correlation',
    message: 'Next Route System input accepted.',
    operation: 'tap' as const,
    origin: 'ui' as const,
    requestId: 'request',
    status: 'accepted' as const,
    timestamp: '2026-08-15T16:29:09.000Z'
  })),
  getSystemCartography: vi.fn(async (systemName?: string) => cartography(systemName ?? 'Unknown'))
} satisfies PlottedRouteProps['api']

test('plotted route derives leg and cumulative distances from Elite coordinates', () => {
  expect(buildRouteLegs(route).map(leg => ({
    cumulative: leg.cumulativeDistance,
    distance: leg.distance
  }))).toEqual([
    { cumulative: 0, distance: 0 },
    { cumulative: 5, distance: 5 },
    { cumulative: 17, distance: 12 }
  ])
})

test('plotted route renders route progress and begins loading the next jump preview', () => {
  const runtimeState = createEmptyRuntimeState()
  runtimeState.system.name = 'Alpha Centauri'
  const markup = renderToStaticMarkup(<PlottedRoute actions={actions} api={api} route={route} runtimeState={runtimeState} />)

  expect(markup).toContain('Plotted navigation route')
  expect(markup).toContain('Next jump')
  expect(markup).toContain('Sirius')
  expect(markup).toContain('12.0 ly')
  expect(markup).toContain('17.0 ly')
  expect(markup).toContain('class="active"')
  expect(markup).toContain('Loading system cartography')
  expect(markup).not.toContain('#TODO')
  expect(markup).toContain('#/galaxy/system?name=Sirius')
})

test('plotted route states honestly when runtime progress is unknown', () => {
  const runtimeState = createEmptyRuntimeState()
  runtimeState.system.name = 'Colonia'
  const markup = renderToStaticMarkup(<PlottedRoute actions={actions} api={api} route={route} runtimeState={runtimeState} />)

  expect(markup).toContain('Route origin')
  expect(markup).toContain('Current system is not present in this route; progress is unknown.')
})

test('plotted route previews only current and forward systems through existing APIs', async () => {
  api.executeAction.mockClear()
  api.getSystemCartography.mockClear()
  const extendedRoute: NavigationRoute = {
    ...route,
    route: [...route.route, { system: 'Lave', address: 4, position: [13, 4, 12], starClass: 'K' }]
  }
  const runtimeState = createEmptyRuntimeState()
  runtimeState.system.name = 'Alpha Centauri'
  let renderer: ReturnType<typeof create> | undefined

  await act(async () => { renderer = create(<PlottedRoute actions={actions} api={api} route={extendedRoute} runtimeState={runtimeState} />) })
  expect(api.getSystemCartography).toHaveBeenLastCalledWith('Sirius', expect.any(AbortSignal))
  expect(JSON.stringify(renderer!.toJSON())).toContain('High Tech')

  const rows = renderer!.root.findAllByType('tr').slice(1)
  expect(rows[0]!.props.onClick).toBeUndefined()
  await act(async () => rows[3]!.props.onClick())
  expect(api.getSystemCartography).toHaveBeenLastCalledWith('Lave', expect.any(AbortSignal))
  expect(JSON.stringify(renderer!.toJSON())).toContain('2 jumps ahead')

  const targetButton = renderer!.root.findAllByType('button').find(button => button.props.className.includes('route-target-command'))
  await act(async () => targetButton!.props.onClick())
  expect(api.executeAction).toHaveBeenCalledWith('elite.TargetNextRouteSystem', 'tap')
  expect(JSON.stringify(renderer!.toJSON())).toContain('Next Route System input accepted.')
  await act(async () => renderer!.unmount())
})

function cartography(systemName: string): CartographyLookupResponse {
  return {
    cache: 'fresh',
    system: {
      address: null,
      bodies: [],
      information: {
        allegiance: 'Independent',
        controllingFaction: null,
        government: null,
        population: 1234,
        primaryEconomy: 'High Tech',
        secondaryEconomy: null,
        security: 'High Security',
        state: null
      },
      localSystem: null,
      name: systemName,
      permitName: null,
      permitRequired: false,
      position: null,
      primaryStar: null,
      raw: { bodies: {}, stations: {}, system: {} },
      scanProgress: { knownBodies: 0, percent: 0, reportedBodies: 3 },
      schemaVersion: 1,
      source: { fetchedAt: '2026-08-15T16:29:09.000Z', provider: 'edsm' },
      stations: []
    }
  }
}
