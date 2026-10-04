import { CartographicSystemSchema } from '@phoenix/contracts'

// Deliberately large, deterministic catalogue, not real commander/provider data.
export function mockDenseCartography(name) {
  const details = {
    absoluteMagnitude: null, ageMillionYears: null, atmosphereComposition: [],
    isMainStar: null, isScoopable: null, luminosity: null, massEarths: null,
    materials: [], reserveLevel: null, rings: [], scanType: null, solarMasses: null,
    solarRadius: null, solidComposition: null, spectralClass: null, starSubclass: null,
    surfacePressurePascals: null, terraformState: null, tidallyLocked: null, volcanism: null,
    orbit: { ascendingNodeDegrees: null, axialTiltDegrees: null, eccentricity: null,
      inclinationDegrees: null, meanAnomalyDegrees: null, orbitalPeriodSeconds: null,
      periapsisDegrees: null, rotationPeriodSeconds: null, semiMajorAxisKilometres: null }
  }
  const bodies = Array.from({ length: 121 }, (_, index) => ({
    id: index, id64: index + 1000, bodyId: index, name: index === 0 ? name : `${name} ${index}`,
    type: index === 0 ? 'Star' : 'Planet', subType: index === 0 ? 'G (White-Yellow) Star' : 'Rocky body',
    distanceToArrival: index * 100, parents: index === 0 ? [] : [{ Star: 0 }],
    landable: index !== 0, gravityGs: null, surfaceTemperatureKelvin: null,
    radiusKilometres: null, atmosphere: null, ringed: false, details,
    firstDiscoveredBy: null, firstFootfallBy: null, firstMappedBy: null, local: null, raw: {}
  }))
  const stations = Array.from({ length: 40 }, (_, index) => ({
    id: index, marketId: index + 1000, name: `Diagnostic station ${index}`,
    type: index < 20 ? 'Fleet Carrier' : 'Coriolis Starport', distanceToArrival: (index + 1) * 100,
    allegiance: null, government: null, economy: null, secondEconomy: null,
    controllingFaction: null, services: [], facilities: { market: false, shipyard: false, outfitting: false },
    raw: { body: { bodyId: index + 1, name: `${name} ${index + 1}` } }
  }))
  return CartographicSystemSchema.parse({
    schemaVersion: 5, name, address: null, position: [0, 0, 0], permitRequired: false, permitName: null,
    information: { allegiance: null, government: null, security: null, state: null,
      primaryEconomy: null, secondaryEconomy: null, population: null, controllingFaction: null },
    primaryStar: null, bodies, stations,
    scanProgress: { knownBodies: bodies.length, reportedBodies: bodies.length, percent: 100 },
    localSystem: null, provenance: { edsm: { fetchedAt: new Date().toISOString() }, journal: null },
    raw: { system: {}, bodies: {}, stations: {} }
  })
}
