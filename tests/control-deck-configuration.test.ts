import { ControlDeckConfigurationSchema } from '@jdu/control-deck-core'
import { expect, test } from 'vitest'

test('Control Deck configuration supports multiple decks and logical displays', () => {
  expect(ControlDeckConfigurationSchema.parse({
    version: 1,
    decks: [deck('ship'), deck('srv')],
    displays: [
      { id: 'left_tablet', name: 'Left tablet', deckId: 'ship', order: 0 },
      { id: 'right_tablet', name: 'Right tablet', deckId: 'srv', order: 1 }
    ]
  })).toMatchObject({
    decks: [{ id: 'ship' }, { id: 'srv' }],
    displays: [{ deckId: 'ship' }, { deckId: 'srv' }]
  })
})

test('Control Deck configuration rejects overlapping and out-of-bounds elements', () => {
  const candidate = deck('ship')
  candidate.elements.push({
    ...candidate.elements[0]!,
    id: 'overlap',
    placement: { kind: 'grid', column: 2, row: 1, columnSpan: 2, rowSpan: 1 }
  })
  candidate.elements.push({
    ...candidate.elements[0]!,
    id: 'outside',
    placement: { kind: 'grid', column: 8, row: 5, columnSpan: 2, rowSpan: 1 }
  })

  const result = ControlDeckConfigurationSchema.safeParse({ version: 1, decks: [candidate], displays: [] })
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.issues.map(issue => issue.message)).toEqual(expect.arrayContaining([
      expect.stringContaining('overlap'),
      expect.stringContaining('exceeds')
    ]))
  }
})

test('Control Deck configuration rejects displays assigned to missing decks', () => {
  expect(() => ControlDeckConfigurationSchema.parse({
    version: 1,
    decks: [],
    displays: [{ id: 'tablet', name: 'Tablet', deckId: 'missing', order: 0 }]
  })).toThrow('references unknown deck')
})

function deck (id: string) {
  return {
    id,
    name: id.toUpperCase(),
    description: '',
    context: `phoenix:${id}`,
    layout: { kind: 'grid' as const, columns: 8, rows: 5 },
    elements: [{
      id: 'cell_1',
      kind: 'command' as const,
      target: {
        adapterId: 'phoenix.commands',
        commandId: 'command.elite.GalaxyMapOpen',
        configuration: {}
      },
      placement: { kind: 'grid' as const, column: 1, row: 1, columnSpan: 2, rowSpan: 1 },
      appearance: { label: null, icon: null, foregroundColor: null, backgroundColor: null },
      interaction: { activation: 'command-default' as const, confirmation: { kind: 'none' as const } }
    }]
  }
}
