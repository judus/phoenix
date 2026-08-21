import { applyControlDeckLayoutPreset, useCustomControlDeckLayout } from '@jdu/control-deck-core'
import { PHOENIX_SHIP_LAYOUT_PRESET } from '@phoenix/contracts'
import { expect, test } from 'vitest'
import { DEFAULT_CONTROL_DECK_CONFIGURATION } from '../apps/server/src/infrastructure/default-control-deck-configuration.js'

test('the PHOENIX Ship preset and Custom layout have distinct geometry', () => {
  const ship = DEFAULT_CONTROL_DECK_CONFIGURATION.decks.find(deck => deck.context === 'phoenix:ship')!
  const custom = useCustomControlDeckLayout(ship)

  expect(custom.layoutPresetId).toBeNull()
  expect(custom.elements.every(element => element.placement.columnSpan === 1)).toBe(true)
  expect(custom.elements.every(element => element.kind === 'command')).toBe(true)

  const preset = applyControlDeckLayoutPreset(custom, PHOENIX_SHIP_LAYOUT_PRESET)
  expect(preset.layoutPresetId).toBe('phoenix.ship')
  expect(preset.layout).toEqual({ kind: 'grid', columns: 8, rows: 5 })
  expect(preset.elements.filter(element => element.placement.row === 5).map(element => [element.placement.column, element.placement.columnSpan]))
    .toEqual([[1, 2], [3, 2], [5, 2], [7, 2]])
  expect(preset.elements.find(element => element.placement.row === 5 && element.placement.column === 1))
    .toMatchObject({ kind: 'command', target: custom.elements.find(element => element.placement.row === 5 && element.placement.column === 1 && element.kind === 'command')?.target })
})
