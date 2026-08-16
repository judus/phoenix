import { describe, expect, test } from 'vitest'
import {
  HOME_ROUTE,
  defaultRouteForWorkspace,
  workspaceForRoute
} from '../apps/web/src/application/navigation/phoenix-route.js'
import {
  parsePhoenixRoute,
  phoenixRouteHash
} from '../apps/web/src/application/navigation/phoenix-router.js'

describe('PHOENIX route parsing and generation', () => {
  test('empty and Home hashes resolve to the Information workspace', () => {
    expect(parsePhoenixRoute('')).toEqual(HOME_ROUTE)
    expect(parsePhoenixRoute('#')).toEqual(HOME_ROUTE)
    expect(parsePhoenixRoute('#/')).toEqual(HOME_ROUTE)
    expect(parsePhoenixRoute('#home')).toEqual(HOME_ROUTE)
    expect(workspaceForRoute(parsePhoenixRoute('#/'))).toBe('info')
  })

  test.each([
    ['#/controls/navigation', { kind: 'controls', category: 'navigation' }, 'controls'],
    ['#/commander/inventory', { kind: 'information', section: 'commander', view: 'inventory' }, 'info'],
    ['#/fleet/ships/current/loadout', { kind: 'information', section: 'fleet', view: 'current-loadout' }, 'info'],
    ['#/galaxy/database', { kind: 'information', section: 'galaxy', view: 'database' }, 'info'],
    ['#/operations/missions', { kind: 'information', section: 'operations', view: 'missions' }, 'info'],
    ['#/engineering/materials/encoded', { kind: 'information', section: 'engineering', view: 'materials-encoded' }, 'info'],
    ['#/comms/radio', { kind: 'information', section: 'comms', view: 'radio' }, 'info'],
    ['#/copilot/profiles', { kind: 'copilot', view: 'profiles' }, 'copilot'],
    ['#/numpad/shortcuts', { kind: 'numpad', view: 'shortcuts' }, 'telemetry'],
    ['#/macros', { kind: 'macros' }, 'macros'],
    ['#/records/journal', { kind: 'journal' }, 'journal'],
    ['#/developer/runtime', { kind: 'developer', view: 'runtime' }, 'developer'],
    ['#/settings/audio', { kind: 'settings', view: 'audio' }, 'settings']
  ] as const)('parses %s as a canonical destination', (hash, route, workspace) => {
    expect(parsePhoenixRoute(hash)).toEqual(route)
    expect(workspaceForRoute(parsePhoenixRoute(hash))).toBe(workspace)
    expect(phoenixRouteHash(parsePhoenixRoute(hash))).toBe(hash)
  })

  test('query state survives parsing and canonical generation', () => {
    const route = parsePhoenixRoute('#/galaxy/system?name=Sol&selected=Earth')
    expect(route).toEqual({
      kind: 'information',
      section: 'galaxy',
      view: 'system',
      systemName: 'Sol',
      selectedName: 'Earth'
    })
    expect(phoenixRouteHash(route)).toBe('#/galaxy/system?name=Sol&selected=Earth')
  })

  test('migrated Commander routes do not expose an arbitrary query bag', () => {
    const route = parsePhoenixRoute('#/commander/progress?rank=combat')

    expect(route).toEqual({ kind: 'information', section: 'commander', view: 'progress' })
    expect(phoenixRouteHash(route)).toBe('#/commander/progress')
  })

  test('Fleet promotes catalogue selection and drops arbitrary query fields', () => {
    const catalogue = parsePhoenixRoute('#/fleet/catalogue?ship=python&layout=cards')
    const overview = parsePhoenixRoute('#/fleet/overview?selected=42')

    expect(catalogue).toEqual({ kind: 'information', section: 'fleet', view: 'catalogue', selectedShipId: 'python' })
    expect(phoenixRouteHash(catalogue)).toBe('#/fleet/catalogue?ship=python')
    expect(overview).toEqual({ kind: 'information', section: 'fleet', view: 'overview' })
  })

  test.each([
    ['#/log', '#/records/journal'],
    ['#/navigation/route', '#/galaxy/route'],
    ['#/ship/modules', '#/fleet/ships/current/loadout'],
    ['#/fleet/current', '#/fleet/ships/current/overview'],
    ['#/ship/inventory', '#/commander/inventory'],
    ['#/exploration/biology?system=Sol&body=Earth', '#/records/exploration/biology?system=Sol&body=Earth']
  ])('normalizes documented compatibility route %s', (alias, canonical) => {
    expect(phoenixRouteHash(parsePhoenixRoute(alias))).toBe(canonical)
  })

  test('workspace destinations use explicit defaults', () => {
    expect(defaultRouteForWorkspace('controls')).toEqual({ kind: 'controls', category: 'ship' })
    expect(defaultRouteForWorkspace('info')).toEqual(HOME_ROUTE)
    expect(defaultRouteForWorkspace('telemetry')).toEqual({ kind: 'numpad', view: 'navigator' })
  })
})
