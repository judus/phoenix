import { expect, test, vi } from 'vitest'
import { createEmptyRuntimeState, type CartographicSystem } from '@phoenix/contracts'
import { StationReferenceResolver } from '../apps/server/src/application/station-reference-resolver.js'
import { InMemoryRuntimeStateStore } from '../apps/server/src/infrastructure/in-memory-runtime-state-store.js'

const TOOL = 'stations.get_station_details'

test('station references use exact normalized names and authoritative market IDs', async () => {
  const system = fixtureSystem()
  system.stations.push({ ...system.stations[0]!, marketId: 43, name: 'Galileo Annex' })
  const resolver = new StationReferenceResolver({ getSystem: async () => ({ cache: 'fresh', system }) }, dockedRuntime())
  await expect(resolver.resolve({ stationName: '  GALILEO  ' }, TOOL)).resolves.toMatchObject({ station: { name: 'Galileo', marketId: 42 } })
  await expect(resolver.resolve({ stationName: 'Galileo', marketId: 43 }, TOOL)).resolves.toMatchObject({ station: { name: 'Galileo Annex', marketId: 43 } })
  await expect(resolver.resolve({ stationName: 'Galileo', marketId: 999 }, TOOL)).rejects.toMatchObject({ code: 'station_not_found' })
})

test('partial station references suggest provider names without selecting or echoing the system input', async () => {
  const system = fixtureSystem('private-system-input')
  system.stations = [
    { ...system.stations[0]!, name: 'Vonarburg Co-operative' },
    { ...system.stations[0]!, name: 'Vonarburg Exchange' }
  ]
  const resolver = new StationReferenceResolver({ getSystem: async () => ({ cache: 'fresh', system }) }, dockedRuntime())
  const pending = resolver.resolve({ systemName: 'private-system-input', stationName: 'Vonarburg' }, TOOL)
  await expect(pending).rejects.toMatchObject({
    code: 'station_not_found',
    message: expect.stringContaining('"Vonarburg Co-operative"')
  })
  await expect(pending).rejects.toThrow('"Vonarburg Exchange"')
  await expect(pending).rejects.not.toThrow('private-system-input')
  await expect(resolver.resolve({ systemName: 'private-system-input', stationName: 'Vonarburg Co-operative' }, TOOL))
    .resolves.toMatchObject({ station: { name: 'Vonarburg Co-operative' } })
})

test('current dock fallback provides local services only in the known current system', async () => {
  const system = fixtureSystem()
  system.stations = []
  const runtime = dockedRuntime()
  const resolver = new StationReferenceResolver({ getSystem: async () => ({ cache: 'local', system }) }, runtime)
  await expect(resolver.resolve({}, TOOL)).resolves.toMatchObject({
    cache: 'local', systemName: 'Sol', station: { name: 'Galileo', marketId: 42, facilities: { market: true, outfitting: true, shipyard: true } }
  })
  await expect(resolver.resolve({ stationName: 'Another station' }, TOOL)).rejects.toMatchObject({ code: 'station_not_found' })
  await expect(resolver.resolve({ marketId: 999 }, TOOL)).rejects.toMatchObject({ code: 'station_not_found' })
  runtime.replace({ ...runtime.getCurrent(), system: { ...runtime.getCurrent().system, name: null } })
  await expect(resolver.resolve({ systemName: 'Sol', stationName: 'Galileo' }, TOOL)).rejects.toMatchObject({ code: 'station_not_found' })
})

test('explicit remote systems never inherit the current dock, including a same-named remote station', async () => {
  const remote = fixtureSystem('Wyrd')
  const getSystem = vi.fn(async () => ({ cache: 'fresh' as const, system: remote }))
  const resolver = new StationReferenceResolver({ getSystem }, dockedRuntime())
  await expect(resolver.resolve({ systemName: 'Wyrd' }, TOOL)).rejects.toMatchObject({ code: 'station_reference_required' })
  expect(getSystem).not.toHaveBeenCalled()
  await expect(resolver.resolve({ systemName: 'Wyrd', stationName: 'Galileo' }, TOOL)).resolves.toMatchObject({ systemName: 'Wyrd' })
  remote.stations = []
  await expect(resolver.resolve({ systemName: 'Wyrd', stationName: 'Galileo' }, TOOL)).rejects.toMatchObject({ code: 'station_not_found' })
})

test('missing current identity needs explicit reference and provider failures remain provider failures', async () => {
  const failure = new Error('cartography failed')
  const resolver = new StationReferenceResolver({ getSystem: async () => { throw failure } }, new InMemoryRuntimeStateStore())
  await expect(resolver.resolve({ stationName: 'Galileo' }, TOOL)).rejects.toMatchObject({ code: 'station_system_required' })
  await expect(resolver.resolve({ systemName: 'Sol', stationName: 'Galileo' }, TOOL)).rejects.toBe(failure)
})

function dockedRuntime (): InMemoryRuntimeStateStore {
  const runtime = new InMemoryRuntimeStateStore()
  const state = createEmptyRuntimeState()
  runtime.replace({
    ...state,
    system: { ...state.system, name: 'Sol' },
    location: { state: 'docked', place: {
      kind: 'station', name: 'Galileo', type: 'Ocellus', marketId: 42,
      faction: null, government: null, primaryEconomy: null, economies: [], services: ['commodities', 'shipyard', 'outfitting']
    } }
  })
  return runtime
}

function fixtureSystem (name = 'Sol'): CartographicSystem {
  return {
    schemaVersion: 5, name, address: 10477373803, position: [0, 0, 0], permitRequired: null, permitName: null,
    information: { allegiance: 'Federation', government: 'Democracy', security: 'High', state: null, primaryEconomy: 'Service', secondaryEconomy: null, population: 23000000000, controllingFaction: 'Mother Gaia' },
    primaryStar: null, bodies: [], scanProgress: { knownBodies: 0, reportedBodies: null, percent: null }, localSystem: null,
    stations: [{
      id: 1, marketId: 42, name: 'Galileo', type: 'Ocellus', distanceToArrival: 495.3,
      allegiance: 'Federation', government: 'Democracy', economy: 'Refinery', secondEconomy: null,
      controllingFaction: 'Mother Gaia', services: ['Repair'], facilities: { market: true, shipyard: true, outfitting: true }, raw: {}
    }],
    provenance: { edsm: { fetchedAt: '2026-08-11T12:00:00.000Z' }, journal: null },
    raw: { system: {}, bodies: {}, stations: {} }
  }
}
