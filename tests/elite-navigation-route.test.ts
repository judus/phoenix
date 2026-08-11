import { expect, test } from 'vitest'
import { parseEliteNavigationRoute } from '@phoenix/elite'

test('NavRoute.json is normalized into route state', () => {
  expect(parseEliteNavigationRoute({
    timestamp: '2026-08-11T12:00:00Z',
    Route: [
      { StarSystem: 'Sol', SystemAddress: 10477373803, StarPos: [0, 0, 0], StarClass: 'G' },
      { StarSystem: 'Alpha Centauri', SystemAddress: 7267755775513, StarPos: [3.03125, -0.09375, 3.15625], StarClass: 'G' }
    ]
  })).toEqual({
    timestamp: '2026-08-11T12:00:00Z',
    route: [
      { system: 'Sol', address: 10477373803, position: [0, 0, 0], starClass: 'G' },
      { system: 'Alpha Centauri', address: 7267755775513, position: [3.03125, -0.09375, 3.15625], starClass: 'G' }
    ]
  })
})
