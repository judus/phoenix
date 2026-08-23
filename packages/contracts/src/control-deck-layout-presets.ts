import { ControlDeckLayoutPresetSchema, type ControlDeckLayoutPreset } from 'control-deck/core'

export const PHOENIX_SHIP_LAYOUT_PRESET = ControlDeckLayoutPresetSchema.parse({
  id: 'phoenix.ship',
  label: 'Phoenix Ship',
  description: 'The standard PHOENIX ship deck with four double-width utility slots.',
  layout: { kind: 'grid', columns: 8, rows: 5 },
  slots: [
    ...Array.from({ length: 4 }, (_, rowIndex) => Array.from({ length: 8 }, (_, columnIndex) => ({
      id: `row_${rowIndex + 1}_column_${columnIndex + 1}`,
      placement: { kind: 'grid' as const, column: columnIndex + 1, row: rowIndex + 1 }
    }))).flat(),
    ...Array.from({ length: 4 }, (_, index) => ({
      id: `utility_${index + 1}`,
      placement: { kind: 'grid' as const, column: index * 2 + 1, row: 5, columnSpan: 2 }
    }))
  ]
})

export const PHOENIX_CONTROL_LAYOUT_PRESETS: readonly ControlDeckLayoutPreset[] = [
  PHOENIX_SHIP_LAYOUT_PRESET
]

export function phoenixControlLayoutPreset (id: string | null | undefined): ControlDeckLayoutPreset | undefined {
  return PHOENIX_CONTROL_LAYOUT_PRESETS.find(preset => preset.id === id)
}
