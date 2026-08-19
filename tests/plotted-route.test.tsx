import { renderToStaticMarkup } from 'react-dom/server'
import { createEmptyRuntimeState, type NavigationRoute } from '@phoenix/contracts'
import { expect, test } from 'vitest'
import { buildRouteLegs, PlottedRoute } from '../apps/web/src/features/galaxy/plotted-route.js'

const route: NavigationRoute = {
  timestamp: '2026-08-15T16:29:09.000Z',
  route: [
    { system: 'Sol', address: 1, position: [0, 0, 0], starClass: 'G' },
    { system: 'Alpha Centauri', address: 2, position: [3, 4, 0], starClass: 'G' },
    { system: 'Sirius', address: 3, position: [3, 4, 12], starClass: 'A' }
  ]
}

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

test('plotted route renders route progress, next jump, and cartography links', () => {
  const runtimeState = createEmptyRuntimeState()
  runtimeState.system.name = 'Alpha Centauri'
  const markup = renderToStaticMarkup(<PlottedRoute route={route} runtimeState={runtimeState} />)

  expect(markup).toContain('Plotted navigation route')
  expect(markup).toContain('Next jump')
  expect(markup).toContain('Sirius')
  expect(markup).toContain('12.0 ly')
  expect(markup).toContain('17.0 ly')
  expect(markup).toContain('class="active"')
  expect(markup).not.toContain('#TODO')
  expect(markup).toContain('#/galaxy/system?name=Sirius')
  expect(markup).toContain('#/galaxy/system?name=Alpha+Centauri')
})

test('plotted route states honestly when runtime progress is unknown', () => {
  const runtimeState = createEmptyRuntimeState()
  runtimeState.system.name = 'Colonia'
  const markup = renderToStaticMarkup(<PlottedRoute route={route} runtimeState={runtimeState} />)

  expect(markup).toContain('Route origin')
  expect(markup).toContain('Current system is not present in this route; progress is unknown.')
})
