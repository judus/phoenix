import { readFileSync } from 'node:fs'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { ControlDeckCommandElementSchema, ControlDeckConfigurationSchema, type ControlDeckCommandCatalogue } from '@jdu/control-deck-core'
import { ButtonEditor, ControlDeckApp, DeckButton, DeckSettings, FeedbackSlot, FullscreenButton, MacroManager, commandFailureMessage, createSubdeck, normalizeDeckHierarchy, toggleFullscreen } from '../apps/control-deck-web/src/control-deck-app.js'
import type { ControlDeckApi } from '../apps/control-deck-web/src/api.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

test('a confirmed command requires hold-to-arm followed by a separate tap', () => {
  vi.useFakeTimers()
  const onTap = vi.fn()
  const element = commandElement('tap', { kind: 'arm-then-tap', armedForMs: 5_000 })
  const renderer = createButton(element, { onTap })
  const button = renderer.root.findByType('button')

  act(() => button.props.onPointerDown(pointerEvent()))
  act(() => vi.advanceTimersByTime(650))
  expect(renderer.toJSON()).toMatchObject({ props: { className: 'deck-button armed' } })
  act(() => button.props.onPointerUp())
  act(() => button.props.onClick())
  expect(onTap).not.toHaveBeenCalled()
  act(() => button.props.onClick())
  expect(onTap).toHaveBeenCalledOnce()
  expect(renderer.toJSON()).toMatchObject({ props: { className: 'deck-button' } })
})

test('the first intentional tap executes when Android emits no click after arming', () => {
  vi.useFakeTimers()
  const onTap = vi.fn()
  const renderer = createButton(commandElement('tap', { kind: 'arm-then-tap', armedForMs: 5_000 }), { onTap })
  const button = renderer.root.findByType('button')

  act(() => button.props.onPointerDown(pointerEvent()))
  act(() => vi.advanceTimersByTime(650))
  act(() => button.props.onPointerUp())
  act(() => vi.advanceTimersByTime(0))
  act(() => button.props.onClick())

  expect(onTap).toHaveBeenCalledOnce()
})

test('a hold command maps pointer lifetime to press and release callbacks', () => {
  const onHoldStart = vi.fn()
  const onHoldEnd = vi.fn()
  const renderer = createButton(commandElement('hold', { kind: 'none' }), { onHoldStart, onHoldEnd })
  const button = renderer.root.findByType('button')

  act(() => button.props.onPointerDown(pointerEvent()))
  expect(onHoldStart).toHaveBeenCalledOnce()
  expect(renderer.toJSON()).toMatchObject({ props: { className: 'deck-button pressed' } })
  const blur = vi.fn()
  act(() => button.props.onPointerUp({ currentTarget: { blur } }))
  expect(onHoldEnd).toHaveBeenCalledOnce()
  expect(blur).toHaveBeenCalledOnce()
  expect(renderer.toJSON()).toMatchObject({ props: { className: 'deck-button' } })
})

test('a tap command shows the themed pressed state for its pointer lifetime', () => {
  const onTap = vi.fn()
  const renderer = createButton(commandElement('tap', { kind: 'none' }), { onTap })
  const button = renderer.root.findByType('button')

  act(() => button.props.onPointerDown(pointerEvent()))
  expect(renderer.toJSON()).toMatchObject({ props: { className: 'deck-button pressed' } })
  act(() => button.props.onPointerUp({ currentTarget: { blur: vi.fn() } }))
  expect(renderer.toJSON()).toMatchObject({ props: { className: 'deck-button' } })
  act(() => button.props.onClick())
  expect(onTap).toHaveBeenCalledOnce()
})

test('the button editor supports right-side modifiers and button colors', () => {
  const onSave = vi.fn()
  let renderer!: ReturnType<typeof create>
  act(() => {
    renderer = create(<ButtonEditor
      deck={{ id: 'main', name: 'Main', description: '', context: null, layout: { kind: 'grid', columns: 2, rows: 2 }, elements: [] }}
      position={{ column: 1, row: 1 }}
      onClose={() => undefined}
      onRemove={() => undefined}
      onSave={onSave}
    />)
  })
  const inputs = renderer.root.findAllByType('input')
  const shortcut = inputs.find(input => input.props.placeholder === 'Tap here, then press a key')!
  expect(shortcut.props.inputMode).toBe('text')
  act(() => inputs[0]!.props.onChange({ target: { value: 'Boost' } }))
  act(() => shortcut.props.onChange({ target: { value: 'b' } }))
  const control = renderer.root.findAllByType('button').find(button => button.children.includes('RCtrl'))!
  act(() => control.props.onClick())
  const color = renderer.root.findAllByType('select').find(select => select.props.value === 'default')!
  act(() => color.props.onChange({ target: { value: 'red' } }))
  const save = renderer.root.findAllByType('button').find(button => button.children.includes('Save button'))!
  act(() => save.props.onClick())

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    target: expect.objectContaining({ configuration: { key: 'b', modifiers: ['RightControl'] } }),
    appearance: expect.objectContaining({ foregroundColor: '#ff6258', backgroundColor: '#3a1717' })
  }))
})

test('the button editor captures Caps Lock as a key rather than a modifier', () => {
  const onSave = vi.fn()
  let renderer!: ReturnType<typeof create>
  act(() => { renderer = create(<ButtonEditor
    deck={{ id: 'main', name: 'Main', description: '', context: null, layout: { kind: 'grid', columns: 1, rows: 1 }, elements: [] }}
    position={{ column: 1, row: 1 }}
    onClose={() => undefined}
    onRemove={() => undefined}
    onSave={onSave}
  />) })
  const inputs = renderer.root.findAllByType('input')
  const shortcut = inputs.find(input => input.props.placeholder === 'Tap here, then press a key')!
  act(() => inputs[0]!.props.onChange({ target: { value: 'Caps' } }))
  act(() => shortcut.props.onKeyDown({
    altKey: false,
    ctrlKey: false,
    key: 'CapsLock',
    preventDefault: vi.fn(),
    shiftKey: false
  }))
  const save = renderer.root.findAllByType('button').find(button => button.children.includes('Save button'))!
  act(() => save.props.onClick())

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    target: expect.objectContaining({ configuration: { key: 'CapsLock', modifiers: [] } })
  }))
})

test('a saved macro can be assigned to a button like a normal command', () => {
  const onSave = vi.fn()
  const catalogue = keyboardCatalogue()
  catalogue.adapters.push({
    id: 'builtin.macro',
    version: '1',
    label: 'Macros',
    available: true,
    simulated: false,
    detail: 'Saved macros.',
    platformRequirements: [],
    holdOwner: 'adapter',
    commands: [{
      id: 'macro_boost',
      label: 'Boost and gear',
      description: 'Boost, wait, then toggle gear.',
      category: 'Macros',
      available: true,
      unavailableReason: null,
      risk: 'safe',
      simulated: false,
      operations: ['tap'],
      configurationSchema: {}
    }]
  })
  let renderer!: ReturnType<typeof create>
  act(() => { renderer = create(<ButtonEditor
    catalogue={catalogue}
    deck={{ id: 'main', name: 'Main', description: '', context: null, layout: { kind: 'grid', columns: 1, rows: 1 }, elements: [] }}
    position={{ column: 1, row: 1 }}
    onClose={() => undefined}
    onRemove={() => undefined}
    onSave={onSave}
  />) })

  const command = renderer.root.findAllByType('select')[0]!
  act(() => command.props.onChange({ target: { value: 'builtin.macro::macro_boost' } }))
  expect(renderer.root.findAllByProps({ placeholder: 'Tap here, then press a key' })).toHaveLength(0)
  const save = renderer.root.findAllByType('button').find(button => button.children.includes('Save button'))!
  act(() => save.props.onClick())

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    target: { adapterId: 'builtin.macro', commandId: 'macro_boost', configuration: {} },
    interaction: expect.objectContaining({ activation: 'tap' })
  }))
})

test('the macro editor builds a sequence from configured deck commands and delays', async () => {
  const configuration = ControlDeckConfigurationSchema.parse({
    version: 1,
    groups: [{ id: 'ship', name: 'Ship', description: '' }],
    decks: [{
      id: 'ship_01',
      groupId: 'ship',
      name: '01',
      description: '',
      context: null,
      layout: { kind: 'grid', columns: 1, rows: 1 },
      elements: [{
        id: 'boost',
        kind: 'command',
        target: { adapterId: 'builtin.keyboard', commandId: 'key', configuration: { key: 'B', modifiers: [] } },
        placement: { kind: 'grid', column: 1, row: 1 },
        appearance: { label: 'Boost' },
        interaction: { activation: 'tap', confirmation: { kind: 'none' } }
      }]
    }],
    displays: []
  })
  const onSave = vi.fn(async () => true)
  let renderer!: ReturnType<typeof create>
  act(() => { renderer = create(<MacroManager
    catalogue={keyboardCatalogue()}
    configuration={configuration}
    library={{ version: 1, macros: [] }}
    onAbort={async () => undefined}
    onClose={() => undefined}
    onDelete={async () => undefined}
    onSave={onSave}
  />) })
  act(() => renderer.root.findAllByType('button').find(button => button.children.includes('+ Macro'))!.props.onClick())
  const name = renderer.root.findAllByType('input').find(input => input.props.autoFocus)!
  act(() => name.props.onChange({ target: { value: 'Launch' } }))
  act(() => renderer.root.findAllByType('button').find(button => button.children.includes('+ Command'))!.props.onClick())
  act(() => renderer.root.findAllByType('button').find(button => button.children.includes('+ Delay'))!.props.onClick())
  const save = renderer.root.findAllByType('button').find(button => button.children.includes('Save macro'))!
  await act(async () => { save.props.onClick(); await Promise.resolve() })

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Launch',
    steps: [
      { type: 'command', target: { adapterId: 'builtin.keyboard', commandId: 'key', configuration: { key: 'B', modifiers: [] } }, operation: 'tap' },
      { type: 'wait', durationMs: 250 }
    ]
  }))
})

test('feedback is absent when idle and rendered as an out-of-flow notice', () => {
  let renderer!: ReturnType<typeof create>
  act(() => { renderer = create(<FeedbackSlot />) })
  expect(renderer.toJSON()).toBeNull()

  act(() => renderer.update(<FeedbackSlot message="Keyboard input accepted." />))
  expect(renderer.toJSON()).toMatchObject({
    props: { className: 'notice' },
    children: ['Keyboard input accepted.']
  })
  const stylesheet = readFileSync(new URL('../apps/control-deck-web/src/styles.css', import.meta.url), 'utf8')
  expect(stylesheet).toMatch(/\.app-shell \{[^}]*grid-template-rows: auto minmax\(0, 1fr\)/u)
  expect(stylesheet).toMatch(/\.notice \{[^}]*position: absolute/u)
  expect(stylesheet).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/u)
  expect(stylesheet).toMatch(/button \{[^}]*-webkit-tap-highlight-color: transparent/u)
  expect(stylesheet).toMatch(/\.deck-button \{[^}]*background: var\(--button-background, var\(--accent-panel\)\)/u)
  expect(stylesheet).toMatch(/\.deck-button:focus-visible \{ outline: none; \}/u)
  expect(stylesheet).toMatch(/\.deck-button\.armed \{[^}]*color-mix/u)
  expect(stylesheet).not.toMatch(/\.deck-button\.armed \{[^}]*box-shadow/u)
  expect(stylesheet).toMatch(/\.empty-button \{[^}]*border-color: var\(--accent\)[^}]*color: var\(--accent\)[^}]*background: #0b1014/u)
  expect(stylesheet).toMatch(/\.subdeck-navigation \{[^}]*flex-direction: column/u)
})

test('deck dimensions allow temporary empty drafts and save only valid values', () => {
  const onChange = vi.fn()
  const onGroupChange = vi.fn()
  let renderer!: ReturnType<typeof create>
  act(() => { renderer = create(<DeckSettings
    deck={{ id: 'main', groupId: 'creative', name: '01', description: '', context: null, layout: { kind: 'grid', columns: 4, rows: 3 }, elements: [] }}
    group={{ id: 'creative', name: 'Creative', description: '', appearance: { colorScheme: 'blue' } }}
    onChange={onChange}
    onGroupChange={onGroupChange}
    onDelete={() => undefined}
  />) })
  const columns = renderer.root.findAllByType('input').find(input => input.props.type === 'number' && input.props.value === '4')!

  act(() => columns.props.onChange({ target: { value: '' } }))
  expect(onChange).not.toHaveBeenCalled()
  act(() => columns.props.onBlur())
  expect(onChange).not.toHaveBeenCalled()
  expect(renderer.root.findAllByType('input').some(input => input.props.value === '4')).toBe(true)

  act(() => columns.props.onChange({ target: { value: '6' } }))
  act(() => columns.props.onBlur())
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ layout: { kind: 'grid', columns: 6, rows: 3 } }))

  const theme = renderer.root.findByType('select')
  act(() => theme.props.onChange({ target: { value: 'violet' } }))
  expect(onGroupChange).toHaveBeenCalledWith(expect.objectContaining({ appearance: { colorScheme: 'violet' } }))
})

test('legacy flat decks become one-subdeck groups without losing their controls', () => {
  const legacy = ControlDeckConfigurationSchema.parse({
    version: 1,
    decks: [{
      id: 'photoshop',
      name: 'Photoshop',
      description: 'Image controls',
      context: null,
      appearance: { colorScheme: 'violet' },
      layout: { kind: 'grid', columns: 2, rows: 2 },
      elements: []
    }],
    displays: [{ id: 'tablet', name: 'Tablet', deckId: 'photoshop', order: 0 }]
  })

  const hierarchical = normalizeDeckHierarchy(legacy)
  expect(hierarchical.groups).toEqual([expect.objectContaining({
    id: 'photoshop',
    name: 'Photoshop',
    appearance: { colorScheme: 'violet' }
  })])
  expect(hierarchical.decks).toEqual([expect.objectContaining({
    id: 'photoshop',
    groupId: 'photoshop',
    name: '01',
    layout: { kind: 'grid', columns: 2, rows: 2 }
  })])
  expect(hierarchical.displays[0]?.deckId).toBe('photoshop')

  const withSecond = createSubdeck(hierarchical, 'photoshop').configuration
  expect(withSecond.decks.map(deck => ({ groupId: deck.groupId, name: deck.name }))).toEqual([
    { groupId: 'photoshop', name: '01' },
    { groupId: 'photoshop', name: '02' }
  ])

  const withGap = { ...withSecond, decks: withSecond.decks.map(deck => deck.name === '02' ? { ...deck, name: '03' } : deck) }
  expect(createSubdeck(withGap, 'photoshop').deck.name).toBe('02')
})

test('the subdeck rail appears only after a second subdeck exists', async () => {
  vi.stubGlobal('document', {
    addEventListener: vi.fn(),
    documentElement: { requestFullscreen: vi.fn(async () => undefined) },
    exitFullscreen: vi.fn(async () => undefined),
    fullscreenElement: null,
    removeEventListener: vi.fn()
  })
  const configuration = ControlDeckConfigurationSchema.parse({
    version: 1,
    groups: [{ id: 'photoshop', name: 'Photoshop', description: '' }],
    decks: [{
      id: 'photoshop_01',
      groupId: 'photoshop',
      name: '01',
      description: '',
      context: null,
      layout: { kind: 'grid', columns: 2, rows: 2 },
      elements: []
    }],
    displays: []
  })
  const api = {
    status: vi.fn(async () => ({ authenticated: true })),
    configuration: vi.fn(async () => configuration),
    commands: vi.fn(async () => ({ adapters: [] })),
    macros: vi.fn(async () => ({ version: 1, macros: [] })),
    saveConfiguration: vi.fn(async candidate => candidate),
    execute: vi.fn()
  } as unknown as ControlDeckApi
  let renderer!: ReturnType<typeof create>
  await act(async () => {
    renderer = create(<ControlDeckApp api={api} />)
    await Promise.resolve()
  })

  expect(renderer.root.findAllByProps({ 'aria-label': 'Subdecks' })).toHaveLength(0)
  expect(renderer.root.findAllByType('small').some(element => element.children.includes('More Buttons. More Better.'))).toBe(true)
  const addDeck = renderer.root.findByProps({ 'aria-label': 'Add deck' })
  expect(addDeck.children).toEqual(['+'])
  const edit = renderer.root.findByProps({ 'aria-label': 'Edit deck' })
  expect(edit.findByType('svg')).toBeDefined()
  act(() => edit.props.onClick())
  expect(renderer.root.findByProps({ 'aria-label': 'Finish editing' }).findByType('svg')).toBeDefined()
  const add = renderer.root.findAllByType('button').find(button => button.children.includes('+ Subdeck'))!
  await act(async () => {
    add.props.onClick()
    await Promise.resolve()
  })

  const rail = renderer.root.findByProps({ 'aria-label': 'Subdecks' })
  expect(rail.props.className).toBe('subdeck-navigation')
  expect(rail.findAllByType('button').map(button => button.children[0])).toEqual(['01', '02', '+'])
})

test('fullscreen toggles the document root and exits through the browser API', async () => {
  const requestFullscreen = vi.fn(() => Promise.resolve())
  const exitFullscreen = vi.fn(() => Promise.resolve())
  const documentSource = {
    documentElement: { requestFullscreen },
    exitFullscreen,
    fullscreenElement: null
  } as unknown as Document

  await toggleFullscreen(documentSource)
  expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' })
  expect(exitFullscreen).not.toHaveBeenCalled()

  Object.defineProperty(documentSource, 'fullscreenElement', { configurable: true, value: documentSource.documentElement })
  await toggleFullscreen(documentSource)
  expect(exitFullscreen).toHaveBeenCalledOnce()
})

test('fullscreen is a compact accessible icon control', () => {
  const documentSource = {
    addEventListener: vi.fn(),
    documentElement: { requestFullscreen: vi.fn(() => Promise.resolve()) },
    exitFullscreen: vi.fn(() => Promise.resolve()),
    fullscreenElement: null,
    removeEventListener: vi.fn()
  } as unknown as Document
  let renderer!: ReturnType<typeof create>
  act(() => { renderer = create(<FullscreenButton documentSource={documentSource} onError={() => undefined} />) })
  const button = renderer.root.findByType('button')

  expect(button.props).toMatchObject({
    'aria-label': 'Enter fullscreen',
    className: 'fullscreen-toggle',
    title: 'Enter fullscreen'
  })
  expect(button.findByType('svg')).toBeDefined()
})

test('successful commands stay silent while command failures remain visible', () => {
  const result = {
    requestId: 'request',
    correlationId: 'correlation',
    target: { adapterId: 'builtin.keyboard', commandId: 'key', configuration: { key: 'A' } },
    operation: 'tap' as const,
    ownerKey: 'session:test',
    timestamp: '2026-08-20T00:00:00.000Z',
    simulated: false
  }
  expect(commandFailureMessage({ ...result, status: 'accepted', message: 'Keyboard input accepted.' })).toBeUndefined()
  expect(commandFailureMessage({ ...result, status: 'failed', message: 'Keyboard input failed.' })).toBe('Keyboard input failed.')
})

function createButton (
  element: ReturnType<typeof commandElement>,
  overrides: Partial<{ onTap(): void, onHoldStart(): void, onHoldEnd(): void }> = {}
) {
  let renderer!: ReturnType<typeof create>
  act(() => {
    renderer = create(<DeckButton
      editing={false}
      element={element}
      label="Cargo eject"
      onEdit={() => undefined}
      onTap={overrides.onTap ?? (() => undefined)}
      onHoldStart={overrides.onHoldStart ?? (() => undefined)}
      onHoldEnd={overrides.onHoldEnd ?? (() => undefined)}
    />)
  })
  return renderer
}

function commandElement (
  activation: 'tap' | 'hold',
  confirmation: { kind: 'none' } | { kind: 'arm-then-tap', armedForMs: number }
) {
  return ControlDeckCommandElementSchema.parse({
    id: 'cargo_eject',
    kind: 'command',
    target: { adapterId: 'builtin.keyboard', commandId: 'key', configuration: { key: 'End' } },
    placement: { kind: 'grid', column: 1, row: 1 },
    appearance: { label: 'Cargo eject' },
    interaction: { activation, confirmation }
  })
}

function pointerEvent () {
  return { pointerId: 1, currentTarget: { setPointerCapture: () => undefined } }
}

function keyboardCatalogue (): ControlDeckCommandCatalogue {
  return { adapters: [{
    id: 'builtin.keyboard',
    version: '1',
    label: 'Keyboard',
    available: true,
    simulated: false,
    detail: 'Keyboard input.',
    platformRequirements: [],
    holdOwner: 'control-deck',
    commands: [{
      id: 'key',
      label: 'Keyboard key',
      description: 'Send a keyboard shortcut.',
      category: 'Input',
      available: true,
      unavailableReason: null,
      risk: 'safe',
      simulated: false,
      operations: ['tap', 'press', 'release'],
      configurationSchema: {}
    }]
  }] }
}
