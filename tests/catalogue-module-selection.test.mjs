import { describe, expect, test } from 'vitest'
import { selectJournalModuleRows } from '../scripts/catalogue/select-journal-module-rows.mjs'

describe('journal module catalogue selection', () => {
  test('keeps the canonical module when pre-engineered mercgear variants reuse its journal symbol', () => {
    const canonical = { symbol: 'Hpt_Slugshot_Gimbal_Small', category: 'hardpoint', name: 'Fragment Cannon' }
    const variant = { symbol: 'Hpt_Slugshot_Gimbal_Small', category: 'mercgear', name: 'Double Screaming Fragment Cannon' }

    expect(selectJournalModuleRows([canonical, variant])).toEqual([canonical])
    expect(selectJournalModuleRows([variant, canonical])).toEqual([canonical])
  })

  test('retains non-conflicting entries, including uniquely identified variants', () => {
    const ordinary = { symbol: 'Int_CargoRack_Size1_Class1', category: 'internal' }
    const uniqueVariant = { symbol: 'Hpt_UniqueSpecialModule', category: 'mercgear' }
    expect(selectJournalModuleRows([ordinary, uniqueVariant])).toEqual([ordinary, uniqueVariant])
  })

  test('rejects duplicate canonical definitions instead of silently choosing one', () => {
    expect(() => selectJournalModuleRows([
      { symbol: 'duplicate', category: 'internal', name: 'First' },
      { symbol: 'DUPLICATE', category: 'standard', name: 'Second' }
    ])).toThrow('ambiguous canonical rows')
  })
})
