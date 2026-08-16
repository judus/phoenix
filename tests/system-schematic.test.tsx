import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import type { CartographicBody, CartographicSystem } from '@phoenix/contracts'
import { buildSystemHierarchy } from '../apps/web/src/features/galaxy/system-hierarchy.js'
import { SystemSchematic } from '../apps/web/src/features/galaxy/system-schematic.js'

test('schematic cartography orders bodies by body id and preserves the complete parent hierarchy', () => {
  const system = fixtureSystem()
  system.bodies.reverse()
  const hierarchy = buildSystemHierarchy(system)

  expect(hierarchy.roots).toHaveLength(1)
  expect(hierarchy.roots[0]?.body.name).toBe('Sol')
  expect(hierarchy.roots[0]?.children.map(node => node.body.name)).toEqual(['Sol A 1', 'Sol A 2'])
  expect(hierarchy.roots[0]?.children[0]?.children.map(node => node.body.name)).toEqual(['Sol A 1 a'])
})

test('schematic cartography prefers reported installation parents and otherwise uses nearest-body distance', () => {
  const system = fixtureSystem()
  system.stations.push({
    ...system.stations[0]!,
    id: 2,
    marketId: 2,
    name: 'Solar Carrier',
    distanceToArrival: 0,
    raw: {}
  })
  const hierarchy = buildSystemHierarchy(system)
  const root = hierarchy.roots[0]!

  expect(root.installations.map(item => [item.station.name, item.source])).toEqual([['Solar Carrier', 'distance']])
  expect(root.children[0]?.installations.map(item => [item.station.name, item.source])).toEqual([['Galileo', 'explicit']])
  expect(hierarchy.unassignedInstallations).toEqual([])
})

test('schematic cartography renders symbolic bodies, stations, and scan markers', () => {
  const markup = renderToStaticMarkup(
    <SystemSchematic
      onSelect={vi.fn()}
      selected={fixtureSystem().bodies[1]}
      system={fixtureSystem()}
    />
  )

  expect(markup).toContain('Schematic map of Sol')
  expect(markup).toContain('system-body--star')
  expect(markup).toContain('system-body--earthlike')
  expect(markup).toContain('system-body--child')
  expect(markup).toContain('Biological signals')
  expect(markup).toContain('Galileo')
  expect(markup).toContain('Installation')
  expect(markup).not.toContain('System summary')
  expect(markup).toContain('has-selection')
})

test('schematic cartography uses the full map workspace until an object is selected', () => {
  const markup = renderToStaticMarkup(
    <SystemSchematic
      onSelect={vi.fn()}
      system={fixtureSystem()}
    />
  )

  expect(markup).toContain('class="system-cartography"')
  expect(markup).not.toContain('has-selection')
  expect(markup).not.toContain('cartography-detail')
})

function fixtureSystem (): CartographicSystem {
  return {
    schemaVersion: 1,
    name: 'Sol',
    address: 10477373803,
    position: [0, 0, 0],
    permitRequired: false,
    permitName: null,
    information: {
      allegiance: 'Federation',
      government: 'Democracy',
      security: 'High',
      state: null,
      primaryEconomy: 'Service',
      secondaryEconomy: null,
      population: 23_000_000_000,
      controllingFaction: 'Mother Gaia'
    },
    primaryStar: null,
    bodies: [
      body(0, 'Sol', 'Star', 'G (White-Yellow) Star', [], 0),
      body(1, 'Sol A 1', 'Planet', 'Earth-like world', [{ Star: 0 }], 500, true),
      body(2, 'Sol A 1 a', 'Planet', 'Rocky body', [{ Planet: 1 }, { Star: 0 }], 501),
      body(3, 'Sol A 2', 'Planet', 'Gas giant with water-based life', [{ Star: 0 }], 900)
    ],
    stations: [{
      id: 1,
      marketId: 128666762,
      name: 'Galileo',
      type: 'Coriolis Starport',
      distanceToArrival: 502,
      allegiance: 'Federation',
      government: 'Democracy',
      economy: 'Service',
      secondEconomy: null,
      controllingFaction: 'Mother Gaia',
      services: ['Repair'],
      facilities: { market: true, shipyard: true, outfitting: true },
      raw: { body: { id: 1, name: 'Sol A 1' } }
    }],
    scanProgress: { knownBodies: 4, reportedBodies: 4, percent: 100 },
    localSystem: null,
    source: { provider: 'edsm', fetchedAt: '2026-08-11T20:00:00.000Z' },
    raw: { system: {}, bodies: {}, stations: {} }
  }
}

function body (
  bodyId: number,
  name: string,
  type: string,
  subType: string,
  parents: Record<string, unknown>[],
  distanceToArrival: number,
  local = false
): CartographicBody {
  return {
    id: bodyId,
    id64: bodyId + 10,
    bodyId,
    name,
    type,
    subType,
    distanceToArrival,
    parents,
    local: local
      ? {
          observedAt: '2026-08-11T20:00:00.000Z',
          discovered: true,
          footfalled: false,
          mapped: true,
          surfaceScanCompleted: true,
          signals: { biological: 2, geological: 0, human: 0 },
          biologicalGenuses: ['Bacterium'],
          organicSamples: [],
          raw: { scan: null, bodySignals: null, surfaceSignals: null }
        }
      : null,
    raw: {}
  }
}
