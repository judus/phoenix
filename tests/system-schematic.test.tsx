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
  const system = fixtureSystem()
  const selected = system.bodies[1]!
  selected.details = {
    ...selected.details,
    atmosphereComposition: [{ name: 'Nitrogen', percent: 78 }],
    massEarths: 1,
    surfacePressurePascals: 101_325,
    terraformState: 'Not terraformable',
    volcanism: 'None'
  }
  const markup = renderToStaticMarkup(
    <SystemSchematic
      commanderName="Ellan Murdock"
      onSelect={vi.fn()}
      selected={selected}
      system={system}
    />
  )

  expect(markup).toContain('Schematic map of Sol')
  expect(markup).toContain('system-body--star')
  expect(markup).toContain('system-body--earthlike')
  expect(markup).toContain('system-body--child')
  expect(markup).toContain('Biological signals')
  expect(markup).toContain('Ellan Murdock')
  expect(markup).toContain('First footfall')
  expect(markup).toContain('Unclaimed when scanned')
  expect(markup).toContain('Atmosphere composition')
  expect(markup).toContain('Nitrogen 78%')
  expect(markup).toContain('Not terraformable')
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
    schemaVersion: 5,
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
    provenance: { edsm: { fetchedAt: '2026-08-11T20:00:00.000Z' }, journal: null },
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
    landable: null,
    gravityGs: null,
    surfaceTemperatureKelvin: null,
    radiusKilometres: null,
    atmosphere: null,
    ringed: false,
    details: emptyDetails(),
    firstDiscoveredBy: null,
    firstFootfallBy: null,
    firstMappedBy: null,
    local: local
      ? {
          observedAt: '2026-08-11T20:00:00.000Z',
          discovered: true,
          footfalled: false,
          mapped: true,
          firstDiscoveredByCommander: true,
          firstMappedByCommander: true,
          previouslyFootfalled: false,
          surfaceScanCompleted: true,
          signals: { biological: 2, geological: 0, human: 0 },
          signalDetails: [{ type: 'Biological', count: 2 }],
          biologicalGenuses: ['Bacterium'],
          organicSamples: [],
          raw: { scan: null, bodySignals: null, surfaceSignals: null }
        }
      : null,
    raw: {}
  }
}

function emptyDetails (): CartographicBody['details'] {
  return {
    absoluteMagnitude: null, ageMillionYears: null, atmosphereComposition: [], isMainStar: null, isScoopable: null,
    luminosity: null, massEarths: null, materials: [], orbit: { ascendingNodeDegrees: null, axialTiltDegrees: null, eccentricity: null, inclinationDegrees: null, meanAnomalyDegrees: null, orbitalPeriodSeconds: null, periapsisDegrees: null, rotationPeriodSeconds: null, semiMajorAxisKilometres: null },
    reserveLevel: null, rings: [], scanType: null, solarMasses: null, solarRadius: null, solidComposition: null,
    spectralClass: null, starSubclass: null, surfacePressurePascals: null, terraformState: null, tidallyLocked: null, volcanism: null
  }
}
