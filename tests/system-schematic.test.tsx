import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import type { CartographicBody, CartographicSystem } from '@phoenix/contracts'
import {
  buildStarGroups,
  SystemSchematic
} from '../apps/web/src/features/navigation/system-schematic.js'

test('schematic cartography groups planets and moons beneath their star', () => {
  const system = fixtureSystem()
  const groups = buildStarGroups(system.bodies)

  expect(groups).toHaveLength(1)
  expect(groups[0]?.star.name).toBe('Sol')
  expect(groups[0]?.branches.map(branch => branch.body.name)).toEqual(['Sol A 1', 'Sol A 2'])
  expect(groups[0]?.branches[0]?.children.map(body => body.name)).toEqual(['Sol A 1 a'])
})

test('schematic cartography renders symbolic bodies, stations, and scan markers', () => {
  const markup = renderToStaticMarkup(
    <SystemSchematic
      onQueryChange={vi.fn()}
      onSearch={vi.fn()}
      onSelect={vi.fn()}
      query="Sol"
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
  expect(markup).toContain('has-selection')
  expect(markup).toContain('aria-label="System name"')
})

test('schematic cartography uses the full map workspace until an object is selected', () => {
  const markup = renderToStaticMarkup(
    <SystemSchematic
      onQueryChange={vi.fn()}
      onSearch={vi.fn()}
      onSelect={vi.fn()}
      query="Sol"
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
      raw: {}
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
