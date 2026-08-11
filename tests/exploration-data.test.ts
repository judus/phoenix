import { describe, expect, it } from 'vitest'
import { ExplorationDataService } from '../apps/server/src/application/exploration-data-service.js'
import type {
  CartographyObservationStore,
  LocalSystemCartographyObservation
} from '../apps/server/src/domain/cartography.js'
import type { BiologicalCompletionOverride } from '../apps/server/src/domain/exploration.js'

describe('ExplorationDataService', () => {
  it('builds a typed cross-system signal and sample ledger', () => {
    const store = new ObservationStore([observation('Synuefe X', '2026-08-11T08:00:00.000Z'), observation('Col 285', '2026-08-10T08:00:00.000Z')])
    const ledger = new ExplorationDataService(store, store).getLedger()

    expect(ledger.systems.map(system => system.name)).toEqual(['Synuefe X', 'Col 285'])
    expect(ledger.systems[0]?.bodies[0]).toMatchObject({
      name: 'Synuefe X 1 A',
      planetClass: 'Rocky body',
      atmosphere: 'thin argon atmosphere',
      signals: { biological: 2, geological: 3, human: 0 },
      biologicalGenuses: ['Bacterium']
    })
    expect(ledger.totals).toEqual({
      systems: 2,
      bodies: 2,
      scannedBodies: 2,
      mappedBodies: 2,
      biologicalSignals: 4,
      geologicalSignals: 6,
      samplesCompleted: 2
    })
  })

  it('keeps commander completion corrections separate from journal observations', () => {
    const store = new ObservationStore([observation('Synuefe X', '2026-08-11T08:00:00.000Z')])
    const service = new ExplorationDataService(store, store)
    const body = service.getLedger().systems[0]!.bodies[0]!

    expect(service.setBiologicalSignalManualCompletion(
      body.key,
      '$Codex_Ent_Bacterial_Genus_Name;',
      true
    )).toBe(true)
    expect(service.getLedger().systems[0]!.bodies[0]!.manualBiologicalCompletions).toHaveLength(1)
    expect(store.getObservation('Synuefe X')!.bodies[0]!.organicSamples[0]!.completed).toBe(true)
  })
})

class ObservationStore implements CartographyObservationStore {
  private readonly overrides: BiologicalCompletionOverride[] = []
  public constructor (private readonly observations: LocalSystemCartographyObservation[]) {}
  public getObservation (name: string) { return this.observations.find(item => item.systemName === name) ?? null }
  public listObservations () { return this.observations }
  public putObservation (_observation: LocalSystemCartographyObservation) {}
  public listBiologicalCompletionOverrides () { return this.overrides }
  public setBiologicalCompletionOverride (bodyKey: string, signalKey: string, completed: boolean) {
    const index = this.overrides.findIndex(item => item.bodyKey === bodyKey && item.signalKey === signalKey)
    if (index >= 0) this.overrides.splice(index, 1)
    if (completed) this.overrides.push({ bodyKey, signalKey, completedAt: '2026-08-11T09:00:00.000Z' })
  }
}

function observation (systemName: string, updatedAt: string): LocalSystemCartographyObservation {
  return {
    allBodiesFound: true,
    systemName,
    systemAddress: 42,
    reportedBodyCount: 4,
    updatedAt,
    bodies: [{
      bodyId: 1,
      bodyName: `${systemName} 1 A`,
      bodySignals: null,
      discovered: false,
      footfalled: false,
      mapped: true,
      observedAt: updatedAt,
      organicSamples: [{
        completed: true,
        genus: 'Bacterium',
        genusId: '$Codex_Ent_Bacterial_Genus_Name;',
        lastUpdated: updatedAt,
        progress: 3,
        scanTypes: ['Log', 'Sample', 'Analyse'],
        species: 'Bacterium Aurasus',
        speciesId: null,
        variant: 'Bacterium Aurasus Teal',
        variantId: null
      }],
      scan: {
        PlanetClass: 'Rocky body',
        Atmosphere: 'thin argon atmosphere',
        Volcanism: 'minor rocky magma volcanism'
      },
      surfaceScanCompleted: true,
      surfaceSignals: {
        Signals: [
          { Type: '$SAA_SignalType_Biological;', Count: 2 },
          { Type: '$SAA_SignalType_Geological;', Count: 3 }
        ],
        Genuses: [{ Genus: '$Codex_Ent_Bacterial_Genus_Name;', Genus_Localised: 'Bacterium' }]
      }
    }]
  }
}
