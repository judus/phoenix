import { act, create } from 'react-test-renderer'
import { expect, test, vi } from 'vitest'
import { createControlDeckGroup, removeControlDeck } from 'control-deck/core'
import { InputGroup, Status, Toast, Widget } from '@phoenix/ui'
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
  const edit = vi.fn()
  const renderer = await renderWithAct(<ManageDecksPage controller={{ status: 'ready', configuration: initial }} onSave={save} onEdit={edit} />)
  const button = (label: string) => renderer.root.findAllByType('button').find(node => node.children.join('') === label)!
  try {
    expect(renderer.root.findAllByType(Widget)).toHaveLength(9)
    expect(renderer.root.findAllByType('table')).toHaveLength(0)
    expect(renderer.root.findAllByType('button').some(node => node.props['aria-label']?.startsWith('Open '))).toBe(false)
    expect(renderer.root.findAllByType(InputGroup)).toHaveLength(9)
    const nameGroup = renderer.root.findAllByType(InputGroup)[0]!
    expect(nameGroup.props.className).toBe('filled')
    expect(nameGroup.findByType('label').props.htmlFor).toBe('deck-name-quick')
    expect(nameGroup.findByType('label').findByProps({ role: 'button' }).props['aria-label']).toBe('Reorder Quick access')
    expect(nameGroup.findByType('input').props['aria-label']).toBe('Deck name 1')
    expect(JSON.stringify(renderer.toJSON())).not.toContain('4 × 3')
    const editButton = renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'Edit Quick access')!
    expect(editButton.props.title).toBe('Edit Quick access')
    expect(editButton.props.className).toContain('btn-icon')
    expect(editButton.props.className).toContain('btn-icon-square')
    expect(editButton.props.className).toContain('btn-outline')
    expect(editButton.props.className).not.toContain('btn-sm')
    await act(async () => editButton.props.onClick())
    expect(edit).toHaveBeenCalledExactlyOnceWith('quick')
    const newDeck = renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'New deck')!
    expect(newDeck.props.className).toContain('btn-primary')
    expect(newDeck.props.className).toContain('btn-icon-square')
    expect(newDeck.children.join('')).toBe('+')
    expect(renderer.root.findAllByType('button').some(node => node.children.join('') === 'Save changes')).toBe(false)
    await act(async () => newDeck.props.onClick())
    expect(save).toHaveBeenCalledTimes(1)
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Deck name 10' }).props.onChange({ target: { value: 'My trips' } }))
    const preventDefault = vi.fn()
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Reorder My trips' }).props.onKeyDown({ key: 'ArrowUp', preventDefault }))
    expect(preventDefault).toHaveBeenCalledOnce()
    await act(async () => renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'Delete Quick access')!.props.onClick())
    expect(save).toHaveBeenCalledTimes(2)
    expect(initial.decks[0]!.id).toBe('quick')
    await act(async () => button('Confirm delete').props.onClick())
    const saved = save.mock.calls.at(-1)![0]
    expect(saved.decks).toHaveLength(9)
    expect(saved.decks.some(deck => deck.id === 'quick')).toBe(false)
    expect(saved.groups!.some(group => group.name === 'My trips')).toBe(true)
    expect(saved.groups!.find(group => group.id === saved.decks[7]!.groupId)?.name).toBe('My trips')
    expect(saved.decks.find(deck => deck.id === 'ship')).toEqual(initial.decks.find(deck => deck.id === 'ship'))
    expect(save).toHaveBeenCalledTimes(3)
  } finally { await act(async () => renderer.unmount()) }
})

test('manager touch drag saves only on a valid drop and cancellation preserves order', async () => {
  const initial = structuredClone(DEFAULT_CONTROL_DECK_CONFIGURATION)
  const save = vi.fn(async (configuration: PhoenixControlDeckConfiguration) => configuration)
  let targetId: string | undefined = 'combat'
  const surface = { scrollTop: 0, contains: () => true, getBoundingClientRect: () => ({ top: 0, bottom: 500 }) }
  const handle = { setPointerCapture: vi.fn() }
  vi.stubGlobal('document', { elementFromPoint: () => targetId ? { closest: () => ({ dataset: { deckId: targetId } }) } : null })
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<ManageDecksPage controller={{ status: 'ready', configuration: initial }}
    onSave={save} onEdit={vi.fn()} />, {
    createNodeMock: node => (node.props as { className?: string }).className === 'deck-list' ? surface : null
  }) })
  const list = () => renderer.root.findByProps({ className: 'deck-list' })
  const grip = () => renderer.root.findByProps({ 'aria-label': 'Reorder Quick access' })
  const order = () => renderer.root.findAllByType(Widget).map(node => node.props['data-deck-id'])
  const event = (y: number, pointerId = 1) => ({ pointerId, isPrimary: true, button: 0, clientX: 100, clientY: y, currentTarget: handle })
  try {
    await act(async () => grip().props.onPointerDown(event(100)))
    await act(async () => list().props.onPointerMove(event(250, 2)))
    expect(renderer.root.findAllByType(Widget).some(node => node.props.className.includes('moving'))).toBe(false)
    await act(async () => list().props.onPointerMove(event(250)))
    expect(handle.setPointerCapture).toHaveBeenCalledWith(1)
    expect(renderer.root.findAllByType(Widget).find(node => node.props['data-deck-id'] === 'quick')!.props.style.transform).toBe('translateY(150px)')
    expect(renderer.root.findAllByType(Widget).find(node => node.props['data-deck-id'] === 'combat')!.props.className).toContain('drop-after')
    expect(order()).toEqual(initial.decks.map(deck => deck.id))
    await act(async () => list().props.onPointerCancel())
    await act(async () => list().props.onPointerUp(event(250)))
    expect(order()).toEqual(initial.decks.map(deck => deck.id))
    await act(async () => grip().props.onPointerDown(event(100)))
    await act(async () => list().props.onPointerMove(event(250)))
    targetId = undefined
    await act(async () => list().props.onPointerUp(event(250)))
    expect(order()).toEqual(initial.decks.map(deck => deck.id))
    targetId = 'combat'
    await act(async () => grip().props.onPointerDown(event(100)))
    await act(async () => list().props.onPointerMove(event(250)))
    await act(async () => list().props.onPointerUp(event(250)))
    expect(order().slice(0, 3)).toEqual(['ship', 'combat', 'quick'])
    expect(save).toHaveBeenCalledOnce()
    expect(initial.decks[0]!.id).toBe('quick')
    expect(save.mock.calls[0]![0].decks[2]).toEqual(initial.decks[0])
  } finally {
    await act(async () => renderer.unmount())
    vi.unstubAllGlobals()
  }
})

test('Edit saves pending manager changes before navigating and preserves drafts on failure', async () => {
  let resolveSave!: (configuration: PhoenixControlDeckConfiguration) => void
  let rejectSave!: (cause: Error) => void
  const save = vi.fn((_configuration: PhoenixControlDeckConfiguration) => new Promise<PhoenixControlDeckConfiguration>((resolve, reject) => {
    resolveSave = resolve; rejectSave = reject
  }))
  const edit = vi.fn()
  const renderer = await renderWithAct(<ManageDecksPage controller={{ status: 'ready', configuration: DEFAULT_CONTROL_DECK_CONFIGURATION }}
    onSave={save} onEdit={edit} />)
  const button = () => renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'Edit Renamed')!
  try {
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Deck name 1' }).props.onChange({ target: { value: 'Renamed' } }))
    expect(button().props.disabled).toBe(false)
    await act(async () => button().props.onClick())
    expect(button().props.disabled).toBe(true)
    expect(edit).not.toHaveBeenCalled()
    await act(async () => rejectSave(new Error('Synthetic save failure')))
    expect(edit).not.toHaveBeenCalled()
    expect(renderer.root.findByProps({ 'aria-label': 'Deck name 1' }).props.value).toBe('Renamed')
    expect(JSON.stringify(renderer.toJSON())).toContain('Synthetic save failure')
    expect(renderer.root.findByType(Toast).props.tone).toBe('danger')
    expect(renderer.root.findAllByType(Status)).toHaveLength(0)
    await act(async () => renderer.root.findByType(Toast).props.onDismiss())
    expect(renderer.root.findAllByType(Toast)).toHaveLength(0)
    await act(async () => button().props.onClick())
    await act(async () => resolveSave(save.mock.calls[1]![0]!))
    expect(edit).toHaveBeenCalledExactlyOnceWith('quick')
  } finally { await act(async () => renderer.unmount()) }
})

test('name autosave coalesces typing and serializes newer edits using the returned revision', async () => {
  vi.useFakeTimers()
  const pending: Array<(configuration: PhoenixControlDeckConfiguration) => void> = []
  const save = vi.fn((_configuration: PhoenixControlDeckConfiguration) => new Promise<PhoenixControlDeckConfiguration>(resolve => pending.push(resolve)))
  const renderer = await renderWithAct(<ManageDecksPage controller={{ status: 'ready', configuration: DEFAULT_CONTROL_DECK_CONFIGURATION }}
    onSave={save} onEdit={vi.fn()} />)
  const field = () => renderer.root.findByProps({ 'aria-label': 'Deck name 1' })
  const rename = async (value: string) => { await act(async () => field().props.onChange({ target: { value } })) }
  try {
    await rename('Ren')
    await rename('Renamed')
    await act(async () => { await vi.advanceTimersByTimeAsync(399) })
    expect(save).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(save).toHaveBeenCalledOnce()
    expect(field().props.disabled).not.toBe(true)
    await rename('Renamed again')
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    expect(save).toHaveBeenCalledOnce()
    const first = save.mock.calls[0]![0]
    await act(async () => pending[0]!({ ...first, revision: first.revision + 1 }))
    expect(save).toHaveBeenCalledTimes(2)
    const second = save.mock.calls[1]![0]
    expect(second.revision).toBe(first.revision + 1)
    expect(second.groups!.find(group => group.id === second.decks[0]!.groupId)!.name).toBe('Renamed again')
    expect(field().props.value).toBe('Renamed again')
    await act(async () => pending[1]!({ ...second, revision: second.revision + 1 }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    expect(save).toHaveBeenCalledTimes(2)
  } finally {
    await act(async () => renderer.unmount())
    vi.useRealTimers()
  }
})

test('leaving the manager flushes pending names and an invalid empty name is never persisted', async () => {
  vi.useFakeTimers()
  const save = vi.fn(async (configuration: PhoenixControlDeckConfiguration) => configuration)
  let renderer = await renderWithAct(<ManageDecksPage controller={{ status: 'ready', configuration: DEFAULT_CONTROL_DECK_CONFIGURATION }}
    onSave={save} onEdit={vi.fn()} />)
  try {
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Deck name 1' }).props.onChange({ target: { value: 'Before leaving' } }))
    await act(async () => renderer.unmount())
    expect(save).toHaveBeenCalledOnce()
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    expect(save).toHaveBeenCalledOnce()
    renderer = await renderWithAct(<ManageDecksPage controller={{ status: 'ready', configuration: DEFAULT_CONTROL_DECK_CONFIGURATION }}
      onSave={save} onEdit={vi.fn()} />)
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Deck name 1' }).props.onChange({ target: { value: '' } }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    expect(save).toHaveBeenCalledOnce()
    expect(renderer.root.findByProps({ 'aria-label': 'Deck name 1' }).props.value).toBe('')
    expect(renderer.root.findByType(Toast).props.tone).toBe('warning')
    expect(renderer.root.findAllByType(Status)).toHaveLength(0)
    await act(async () => renderer.root.findByType(Toast).props.onDismiss())
    expect(renderer.root.findAllByType(Toast)).toHaveLength(0)
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Deck name 1' }).props.onChange({ target: { value: 'Valid again' } }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    expect(save).toHaveBeenCalledTimes(2)
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Deck name 1' }).props.onChange({ target: { value: '' } }))
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    expect(renderer.root.findByType(Toast).props.tone).toBe('warning')
  } finally {
    await act(async () => renderer.unmount())
    vi.useRealTimers()
  }
})
