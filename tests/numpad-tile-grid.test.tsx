import { expect, test } from 'vitest'
import { balancedColumnCount } from '../apps/web/src/features/numpad/numpad-tile-grid.js'

test('generic numpad branches use balanced tile grids', () => {
  expect(balancedColumnCount(3)).toBe(3)
  expect(balancedColumnCount(7)).toBe(4)
  expect(balancedColumnCount(8)).toBe(4)
  expect(balancedColumnCount(40)).toBe(8)
})
