import { PHOENIX_SHIP_LAYOUT_PRESET, applyControlGridPageLayoutPreset } from '@phoenix/contracts'
import { expect, test } from 'vitest'
import { DEFAULT_CONTROL_GRID_LAYOUT } from '../apps/server/src/infrastructure/default-control-grid-layout.js'

test('the PHOENIX Ship preset and Custom layout have distinct geometry', () => {
  const ship = DEFAULT_CONTROL_GRID_LAYOUT.pages.find(page => page.category === 'ship')!
  const custom = applyControlGridPageLayoutPreset(ship, null)

  expect(custom.layoutPresetId).toBeNull()
  expect(custom.cells.every(cell => cell.span === 1)).toBe(true)
  expect(custom.cells.every(cell => cell.target !== null)).toBe(true)

  const preset = applyControlGridPageLayoutPreset(custom, PHOENIX_SHIP_LAYOUT_PRESET)
  expect(preset.layoutPresetId).toBe('phoenix.ship')
  expect(preset.columns).toBe(8)
  expect(preset.rows).toBe(5)
  expect(preset.cells.filter(cell => cell.position >= 33).map(cell => [cell.position, cell.span]))
    .toEqual([[33, 2], [35, 2], [37, 2], [39, 2]])
  expect(preset.cells.find(cell => cell.position === 33)?.target).toEqual(custom.cells.find(cell => cell.position === 33)?.target)
})
