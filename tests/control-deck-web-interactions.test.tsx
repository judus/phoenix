import { act, create } from 'react-test-renderer'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { ControlDeckCommandElementSchema } from '@jdu/control-deck-core'
import { DeckButton } from '../apps/control-deck-web/src/control-deck-app.js'

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

test('a hold command maps pointer lifetime to press and release callbacks', () => {
  const onHoldStart = vi.fn()
  const onHoldEnd = vi.fn()
  const renderer = createButton(commandElement('hold', { kind: 'none' }), { onHoldStart, onHoldEnd })
  const button = renderer.root.findByType('button')

  act(() => button.props.onPointerDown(pointerEvent()))
  expect(onHoldStart).toHaveBeenCalledOnce()
  act(() => button.props.onPointerUp())
  expect(onHoldEnd).toHaveBeenCalledOnce()
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
