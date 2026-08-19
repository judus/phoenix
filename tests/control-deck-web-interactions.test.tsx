import { readFileSync } from 'node:fs'
import { act, create } from 'react-test-renderer'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { ControlDeckCommandElementSchema } from '@jdu/control-deck-core'
import { ButtonEditor, DeckButton, DeckSettings, FeedbackSlot, FullscreenButton, toggleFullscreen } from '../apps/control-deck-web/src/control-deck-app.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))
afterEach(() => vi.useRealTimers())

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
  act(() => button.props.onPointerUp())
  expect(onHoldEnd).toHaveBeenCalledOnce()
  expect(renderer.toJSON()).toMatchObject({ props: { className: 'deck-button' } })
})

test('the button editor supports the virtual keyboard and modifier toggles', () => {
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
  const control = renderer.root.findAllByType('button').find(button => button.children.includes('Ctrl'))!
  act(() => control.props.onClick())
  const save = renderer.root.findAllByType('button').find(button => button.children.includes('Save button'))!
  act(() => save.props.onClick())

  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    target: expect.objectContaining({ configuration: { key: 'b', modifiers: ['LeftControl'] } })
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
})

test('deck dimensions allow temporary empty drafts and save only valid values', () => {
  const onChange = vi.fn()
  let renderer!: ReturnType<typeof create>
  act(() => { renderer = create(<DeckSettings
    deck={{ id: 'main', name: 'Main', description: '', context: null, layout: { kind: 'grid', columns: 4, rows: 3 }, elements: [] }}
    onChange={onChange}
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
