import { createEmptyRuntimeState } from '@phoenix/contracts'
import { expect, test } from 'vitest'
import { createCommanderViewModel } from '../apps/web/src/features/commander/commander-view-model.js'

test('commander view model preserves raw rank and inventory provenance', () => {
  const empty = createEmptyRuntimeState()
  const model = createCommanderViewModel({
    ...empty,
    commander: {
      ...empty.commander,
      name: 'Ellan Murdock',
      ranks: { ...empty.commander.ranks, combat: 5 },
      rankProgress: { ...empty.commander.rankProgress, combat: 72 }
    },
    inventory: {
      ...empty.inventory,
      shipLocker: {
        updatedAt: '2026-08-16T12:00:00.000Z',
        items: [{ id: 'ancient_key', label: null, count: 2, ownerId: 14, missionId: null }],
        components: [],
        consumables: [{ id: 'healthpack', label: 'Medkit', count: 3, ownerId: null, missionId: 91 }],
        data: []
      }
    }
  })

  expect(model.name).toBe('Ellan Murdock')
  expect(model.ranks[0]).toMatchObject({ label: 'Combat', level: 'Level 5', progress: 72, progressLabel: '72%' })
  expect(model.stores[0]?.categories[0]?.items[0]).toMatchObject({
    identifier: 'ancient_key',
    name: 'ancient_key',
    provenance: 'Owner 14'
  })
  expect(model.stores[0]?.categories[2]?.items[0]).toMatchObject({
    identifier: 'healthpack',
    name: 'Medkit',
    provenance: 'Mission 91'
  })
})

test('commander view model reports honest unknowns when snapshots are absent', () => {
  const model = createCommanderViewModel(createEmptyRuntimeState())

  expect(model.name).toBe('Unknown commander')
  expect(model.ranks.every(rank => rank.level === '—' && rank.progressLabel === 'Not reported')).toBe(true)
  expect(model.stores.map(store => store.meta)).toEqual(['0 units · No snapshot', '0 units · No snapshot'])
})
