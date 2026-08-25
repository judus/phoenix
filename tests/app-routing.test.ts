import { describe, expect, test } from 'vitest'
import {
  HOME_ROUTE,
  defaultRouteForInformationSection,
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
    ['#/fleet/ships/current/engineering', { kind: 'information', section: 'fleet', view: 'current-engineering' }, 'info'],
    ['#/galaxy/database', { kind: 'information', section: 'galaxy', view: 'database' }, 'info'],
    ['#/activities/missions', { kind: 'information', section: 'activities', view: 'missions' }, 'info'],
    ['#/engineering/materials/encoded', { kind: 'information', section: 'engineering', view: 'materials-encoded' }, 'info'],
    ['#/comms/radio', { kind: 'information', section: 'comms', view: 'radio' }, 'info'],
    ['#/copilot/profiles', { kind: 'copilot', view: 'profiles' }, 'copilot'],
    ['#/numpad', { kind: 'numpad' }, 'telemetry'],
    ['#/macros', { kind: 'macros' }, 'macros'],
    ['#/records/journal', { kind: 'journal', view: 'journal' }, 'journal'],
    ['#/records/credits', { kind: 'journal', view: 'credits' }, 'journal'],
    ['#/developer/runtime', { kind: 'developer', view: 'runtime' }, 'journal'],
    ['#/settings', { kind: 'settings', view: 'dashboard' }, 'settings'],
    ['#/settings/help', { kind: 'settings', view: 'help' }, 'settings']
  ] as const)('parses %s as a canonical destination', (hash, route, workspace) => {
    expect(parsePhoenixRoute(hash)).toEqual(route)
    expect(workspaceForRoute(parsePhoenixRoute(hash))).toBe(workspace)
    expect(phoenixRouteHash(parsePhoenixRoute(hash))).toBe(hash)
  })

  test('legacy Settings pages resolve to the dashboard', () => {
    const route = parsePhoenixRoute('#/settings/audio')

    expect(route).toEqual({ kind: 'settings', view: 'dashboard' })
    expect(phoenixRouteHash(route)).toBe('#/settings')
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

    expect(route).toEqual({ kind: 'information', section: 'commander', view: 'career' })
    expect(phoenixRouteHash(route)).toBe('#/commander/career')
    expect(phoenixRouteHash(parsePhoenixRoute('#/commander/overview'))).toBe('#/commander/career')
  })

  test('Activities routes do not preserve arbitrary query fields', () => {
    const route = parsePhoenixRoute('#/activities/missions?selected=42')

    expect(route).toEqual({ kind: 'information', section: 'activities', view: 'missions' })
    expect(phoenixRouteHash(route)).toBe('#/activities/missions')
  })

  test('Activities discards retired review-fixture fields', () => {
    const route = parsePhoenixRoute('#/activities/missions?fixture=review&selected=42')

    expect(route).toEqual({ kind: 'information', section: 'activities', view: 'missions' })
    expect(phoenixRouteHash(route)).toBe('#/activities/missions')
  })

  test('Activities lands on Missions and normalizes the retired overview route', () => {
    expect(defaultRouteForInformationSection('activities')).toEqual({ kind: 'information', section: 'activities', view: 'missions' })
    expect(phoenixRouteHash(parsePhoenixRoute('#/activities/overview'))).toBe('#/activities/missions')
    expect(phoenixRouteHash(parsePhoenixRoute('#/operations/overview'))).toBe('#/activities/missions')
  })

  test('Fleet lands on the current ship dashboard', () => {
    expect(defaultRouteForInformationSection('fleet')).toEqual({ kind: 'information', section: 'fleet', view: 'current-overview' })
  })

  test('Exobiology is an owned Galaxy route', () => {
    const route = parsePhoenixRoute('#/galaxy/exobiology')
    expect(route).toEqual({ kind: 'information', section: 'galaxy', view: 'exobiology' })
    expect(phoenixRouteHash(route)).toBe('#/galaxy/exobiology')
  })

  test('Fleet promotes catalogue selection and drops arbitrary query fields', () => {
    const catalogue = parsePhoenixRoute('#/fleet/catalogue?ship=python&layout=cards')
    const overview = parsePhoenixRoute('#/fleet/overview?selected=42')

    expect(catalogue).toEqual({ kind: 'information', section: 'fleet', view: 'catalogue', selectedShipId: 'python' })
    expect(phoenixRouteHash(catalogue)).toBe('#/fleet/catalogue?ship=python')
    expect(overview).toEqual({ kind: 'information', section: 'fleet', view: 'overview' })
  })

  test('Engineering promotes blueprint selection and drops arbitrary query fields', () => {
    const blueprint = parsePhoenixRoute('#/engineering/blueprints?symbol=dirty-drive&layout=cards')
    const materials = parsePhoenixRoute('#/engineering/materials/raw?group=elements')
    expect(blueprint).toEqual({ kind: 'information', section: 'engineering', view: 'blueprints', selectedBlueprintSymbol: 'dirty-drive' })
    expect(phoenixRouteHash(blueprint)).toBe('#/engineering/blueprints?symbol=dirty-drive')
    expect(materials).toEqual({ kind: 'information', section: 'engineering', view: 'materials-raw' })
  })

  test('legacy Exploration selections normalize to the owned System Map route', () => {
    const route = parsePhoenixRoute('#/records/exploration/biology?system=Sol&body=Earth&layout=cards')

    expect(route).toEqual({
      kind: 'information',
      section: 'galaxy',
      view: 'system',
      systemName: 'Sol',
      selectedName: 'Earth'
    })
    expect(phoenixRouteHash(route)).toBe('#/galaxy/system?name=Sol&selected=Earth')
    expect(phoenixRouteHash(parsePhoenixRoute('#/exploration/ledger'))).toBe('#/galaxy/exobiology')
  })

  test.each([
    ['#/log', '#/records/journal'],
    ['#/navigation/route', '#/galaxy/route'],
    ['#/operations/missions', '#/activities/missions'],
    ['#/ship/modules', '#/fleet/ships/current/loadout'],
    ['#/fleet/current', '#/fleet/ships/current/overview'],
    ['#/ship/inventory', '#/commander/inventory'],
    ['#/exploration/biology?system=Sol&body=Earth', '#/galaxy/system?name=Sol&selected=Earth']
  ])('normalizes documented compatibility route %s', (alias, canonical) => {
    expect(phoenixRouteHash(parsePhoenixRoute(alias))).toBe(canonical)
  })

  test('workspace destinations use explicit defaults', () => {
    expect(defaultRouteForWorkspace('controls')).toEqual({ kind: 'controls', category: 'ship' })
    expect(defaultRouteForWorkspace('info')).toEqual(HOME_ROUTE)
    expect(defaultRouteForWorkspace('telemetry')).toEqual({ kind: 'numpad' })
  })
})
