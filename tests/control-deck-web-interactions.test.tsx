import { act, create } from 'react-test-renderer'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { ControlDeckCommandElementSchema } from '@jdu/control-deck-core'
import { ButtonEditor, DeckButton, FeedbackSlot } from '../apps/control-deck-web/src/control-deck-app.js'

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

test('feedback has a stable layout slot before and after a command', () => {
  let renderer!: ReturnType<typeof create>
  act(() => { renderer = create(<FeedbackSlot />) })
  expect(renderer.toJSON()).toMatchObject({ props: { className: 'feedback-slot' }, children: null })

  act(() => renderer.update(<FeedbackSlot message="Keyboard input accepted." />))
  expect(renderer.toJSON()).toMatchObject({
    props: { className: 'feedback-slot' },
    children: [{ props: { className: 'notice' }, children: ['Keyboard input accepted.'] }]
  })
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
