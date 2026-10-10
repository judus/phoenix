import { act } from 'react-test-renderer'
import { expect, test, vi } from 'vitest'
import { createControlDeckGroup, removeControlDeck } from 'control-deck/core'
import { DataTable, DataTableGroup } from '@phoenix/ui'
import { PhoenixControlDeckConfigurationSchema, PHOENIX_SHIP_LAYOUT_PRESET, type PhoenixControlDeckConfiguration } from '@phoenix/contracts'
import { ManageDecksPage, reorderDeck } from '../apps/web/src/features/controls/manage-decks-page.js'
import { applyDeckPreset, resizeDeck } from '../apps/web/src/features/controls/controls-page.js'
import { controlsNavigationItems, firstControlDeckId, resolveControlsDestination } from '../apps/web/src/features/controls/controls-navigation.js'
import { parsePhoenixRoute, phoenixRouteHash } from '../apps/web/src/application/navigation/phoenix-router.js'
import { DEFAULT_CONTROL_DECK_CONFIGURATION } from '../apps/server/src/infrastructure/default-control-deck-configuration.js'
import { renderWithAct } from './support/render-with-act.js'

test('custom IDs drive routes and saved order, not game contexts or labels', () => {
  const created = createControlDeckGroup(DEFAULT_CONTROL_DECK_CONFIGURATION)
  const configuration = PhoenixControlDeckConfigurationSchema.parse(created.configuration)
  configuration.groups!.find(group => group.id === created.group.id)!.name = 'Exploration'
  configuration.decks.reverse()
  const items = controlsNavigationItems(configuration)
  expect(items[0]).toMatchObject({ id: created.deck.id, label: 'Exploration', route: { kind: 'controls', deckId: created.deck.id } })
  expect(parsePhoenixRoute(items[0]!.href!)).toEqual(items[0]!.route)
  expect(firstControlDeckId(configuration)).toBe(created.deck.id)
  const deleted = PhoenixControlDeckConfigurationSchema.parse(removeControlDeck(configuration, created.deck.id).configuration)
  expect(resolveControlsDestination(items[0]!.route, deleted)).toEqual({ kind: 'controls', deckId: deleted.decks[0]!.id })
  expect(phoenixRouteHash({ kind: 'controls', deckId: 'manage' })).toBe('#/controls/manage')
  expect(PhoenixControlDeckConfigurationSchema.safeParse({ ...configuration, decks: [] }).success).toBe(false)
})

test('reordering keeps button assignments and IDs intact; safe resize and preset never discard commands', () => {
  const configuration = reorderDeck(DEFAULT_CONTROL_DECK_CONFIGURATION, 0, 2)
  expect(configuration.decks.map(deck => deck.id).slice(0, 3)).toEqual(['ship', 'combat', 'quick'])
  expect(configuration.decks[2]).toEqual(DEFAULT_CONTROL_DECK_CONFIGURATION.decks[0])
  const ship = DEFAULT_CONTROL_DECK_CONFIGURATION.decks.find(deck => deck.id === 'ship')!
  expect(() => resizeDeck(ship, 4, 3)).toThrow('Move or remove buttons')
  expect(resizeDeck(ship, 12, 12).elements).toEqual(ship.elements)
  const outside = { ...ship, layout: { kind: 'grid' as const, columns: 12, rows: 12 },
    elements: [{ ...ship.elements[0]!, placement: { kind: 'grid' as const, column: 12, row: 12, columnSpan: 1, rowSpan: 1 } }] }
  expect(() => applyDeckPreset(outside, PHOENIX_SHIP_LAYOUT_PRESET)).toThrow('preset slots')
})

test('manager creates, renames, reorders, confirms delete and saves without recreating buttons', async () => {
  const initial = structuredClone(DEFAULT_CONTROL_DECK_CONFIGURATION)
  const save = vi.fn(async (configuration: PhoenixControlDeckConfiguration) => ({ ...configuration, revision: configuration.revision + 1 }))
  const open = vi.fn()
  const edit = vi.fn()
  const renderer = await renderWithAct(<ManageDecksPage controller={{ status: 'ready', configuration: initial }} onSave={save} onOpen={open} onEdit={edit} />)
  const button = (label: string) => renderer.root.findAllByType('button').find(node => node.children.join('') === label)!
  try {
    expect(renderer.root.findByType(DataTableGroup).props.fill).toBe(true)
    expect(renderer.root.findByType(DataTable).props).toMatchObject({ narrow: 'priority', scheme: 'surface', stickyHeader: true })
    const editButton = renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'Edit Quick access')!
    expect(editButton.props.title).toBe('Edit Quick access')
    expect(editButton.props.className).toContain('btn-icon')
    expect(editButton.props.className).toContain('btn-icon-square')
    expect(editButton.props.className).toContain('btn-outline')
    await act(async () => editButton.props.onClick())
    expect(edit).toHaveBeenCalledExactlyOnceWith('quick')
    await act(async () => button('New deck').props.onClick())
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Deck name 10' }).props.onChange({ target: { value: 'My trips' } }))
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Move My trips up' }).props.onClick())
    await act(async () => renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'Delete Quick access')!.props.onClick())
    expect(save).not.toHaveBeenCalled()
    expect(initial.decks[0]!.id).toBe('quick')
    await act(async () => button('Confirm delete').props.onClick())
    await act(async () => button('Save changes').props.onClick())
    const saved = save.mock.calls[0]![0]
    expect(saved.decks).toHaveLength(9)
    expect(saved.decks.some(deck => deck.id === 'quick')).toBe(false)
    expect(saved.groups!.some(group => group.name === 'My trips')).toBe(true)
    expect(saved.decks.find(deck => deck.id === 'ship')).toEqual(initial.decks.find(deck => deck.id === 'ship'))
    expect(button('Save changes').props.disabled).toBe(true)
    expect(open).not.toHaveBeenCalled()
  } finally { await act(async () => renderer.unmount()) }
})
