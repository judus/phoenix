import { expect, test } from 'vitest'
import type { ExplorationLedgerResponse } from '@phoenix/contracts'
import { createExobiologyViewModel } from '../apps/web/src/features/galaxy/exobiology-view-model.js'

test('builds journal-backed biological progress and excludes unrelated bodies', () => {
  const model = createExobiologyViewModel(fixture())

  expect(model).toMatchObject({ completed: 1, total: 2 })
  expect(model.systems).toHaveLength(1)
  expect(model.systems[0]).toMatchObject({ completed: 1, name: 'Test System', total: 2 })
  expect(model.systems[0]?.bodies).toHaveLength(1)
  expect(model.systems[0]?.bodies[0]?.samples).toEqual([
    {
      completed: false,
      genus: 'Bacterium',
      id: '$Codex_Ent_Bacterial_Genus_Name;',
      progress: 2,
      species: 'Bacterium Informem',
      variant: 'Bacterium Informem Red'
    },
    {
      completed: true,
      genus: 'Fungoida',
      id: '$Codex_Ent_Fungoids_Genus_Name;',
      progress: 3,
      species: 'Unknown',
      variant: 'Unknown'
    }
  ])
})

function fixture(): ExplorationLedgerResponse {
  return {
    systems: [{
      address: 42,
      allBodiesFound: true,
      bodies: [{
        atmosphere: 'thin carbon dioxide atmosphere',
        biologicalGenuses: ['Bacterium', 'Fungoida'],
        biologicalSignals: [
          { key: '$Codex_Ent_Bacterial_Genus_Name;', name: 'Bacterium' },
          { key: '$Codex_Ent_Fungoids_Genus_Name;', name: 'Fungoida' }
        ],
        bodyId: 1,
        discovered: false,
        footfalled: false,
        key: '42:1',
        manualBiologicalCompletions: [{ completedAt: '2026-08-25T12:04:00.000Z', signalKey: '$Codex_Ent_Fungoids_Genus_Name;' }],
        mapped: false,
        name: 'Test System 1',
        observedAt: '2026-08-25T12:03:00.000Z',
        organicSamples: [{
          completed: false,
          genus: 'Bacterium',
          lastUpdated: '2026-08-25T12:03:00.000Z',
          progress: 2,
          scanTypes: ['Log', 'Sample'],
          species: 'Bacterium Informem',
          variant: 'Bacterium Informem Red'
        }],
        planetClass: 'Rocky body',
        scanned: true,
        signals: { biological: 2, geological: 0, human: 0 },
        surfaceScanCompleted: true,
        systemAddress: 42,
        systemName: 'Test System',
        volcanism: null
      }, {
        atmosphere: null,
        biologicalGenuses: [],
        biologicalSignals: [],
        bodyId: 2,
        discovered: null,
        footfalled: null,
        key: '42:2',
        manualBiologicalCompletions: [],
        mapped: null,
        name: 'Test System 2',
        observedAt: '2026-08-25T12:01:00.000Z',
        organicSamples: [],
        planetClass: null,
        scanned: false,
        signals: { biological: 0, geological: 1, human: 0 },
        surfaceScanCompleted: false,
        systemAddress: 42,
        systemName: 'Test System',
        volcanism: 'minor volcanism'
      }],
      name: 'Test System',
      reportedBodyCount: 2,
      updatedAt: '2026-08-25T12:04:00.000Z'
    }],
    totals: { biologicalSignals: 2, bodies: 2, geologicalSignals: 1, mappedBodies: 1, samplesCompleted: 1, scannedBodies: 1, systems: 1 }
  }
}
