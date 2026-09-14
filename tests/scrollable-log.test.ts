import { expect, test } from 'vitest'
import { bottomAlignedRowTailSpace } from '../apps/web/src/features/dashboard/scrollable-log.js'

test('bottom-aligned logs reserve only the remainder above complete rows', () => {
  expect(bottomAlignedRowTailSpace(180, [
    { start: 0, end: 50 },
    { start: 60, end: 160 },
    { start: 170, end: 230 }
  ])).toBe(10)
  expect(bottomAlignedRowTailSpace(180, [
    { start: 0, end: 80 },
    { start: 80, end: 180 }
  ])).toBe(0)
  expect(bottomAlignedRowTailSpace(180, [{ start: 0, end: 220 }])).toBe(0)
})
