import { expect, test } from 'vitest'
import { readRoute } from '../apps/web/src/app.js'

test('current ship tabs resolve to distinct Fleet views', () => {
  expect(readRoute('#/fleet/ships/current/overview')).toEqual({ section: 'fleet', view: 'status' })
  expect(readRoute('#/fleet/ships/current/loadout')).toEqual({ section: 'fleet', view: 'modules' })
  expect(readRoute('#/fleet/ships/current/cargo')).toEqual({ section: 'fleet', view: 'cargo' })
})

test('galaxy database resolves as a first-class Galaxy view', () => {
  expect(readRoute('#/galaxy/database')).toEqual({ section: 'galaxy', view: 'database' })
})

test('numpad resolves as a dedicated information surface', () => {
  expect(readRoute('#/numpad')).toEqual({ section: 'numpad', view: 'navigator' })
  expect(readRoute('#/numpad/shortcuts')).toEqual({ section: 'numpad', view: 'shortcuts' })
})
