import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import { useWorkspaceFocus } from '../apps/web/src/components/shell/use-workspace-focus.js'

beforeAll(() => Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }))

test('focus view toggles explicitly and Escape exits it', () => {
  const listeners = new Set<(event: KeyboardEvent) => void>()
  const add = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
    if (type === 'keydown') listeners.add(listener as (event: KeyboardEvent) => void)
  })
  const remove = vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
    if (type === 'keydown') listeners.delete(listener as (event: KeyboardEvent) => void)
  })
  vi.stubGlobal('addEventListener', add)
  vi.stubGlobal('removeEventListener', remove)

  try {
    let renderer!: ReturnType<typeof create>
    act(() => { renderer = create(<FocusHarness />) })
    const button = renderer.root.findByType('button')

    act(() => button.props.onClick())
    expect(renderer.root.findByType('main').props['data-active']).toBe(true)

    const preventDefault = vi.fn()
    act(() => {
      for (const listener of listeners) listener({ key: 'Escape', preventDefault } as unknown as KeyboardEvent)
    })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(renderer.root.findByType('main').props['data-active']).toBe(false)
  } finally {
    vi.unstubAllGlobals()
  }
})

test('a two-touch pinch enters and exits focus without treating one touch as focus input', () => {
  let renderer!: ReturnType<typeof create>
  act(() => { renderer = create(<FocusHarness />) })
  let target = renderer.root.findByType('main')

  act(() => {
    target.props.onPointerDownCapture(pointer(1, 0))
    target.props.onPointerMoveCapture(pointer(1, 40))
  })
  expect(renderer.root.findByType('main').props['data-active']).toBe(false)

  act(() => {
    target.props.onPointerDownCapture(pointer(2, 140))
    target.props.onPointerMoveCapture(pointer(2, 180))
  })
  expect(renderer.root.findByType('main').props['data-active']).toBe(true)

  target = renderer.root.findByType('main')
  act(() => {
    target.props.onPointerUpCapture(pointer(1, 40))
    target.props.onPointerUpCapture(pointer(2, 180))
    target.props.onPointerDownCapture(pointer(3, 0))
    target.props.onPointerDownCapture(pointer(4, 125))
    target.props.onPointerMoveCapture(pointer(4, 95))
  })
  expect(renderer.root.findByType('main').props['data-active']).toBe(false)
})

function FocusHarness() {
  const focus = useWorkspaceFocus()
  return <main
    data-active={focus.active}
    onClickCapture={focus.onClickCapture}
    onPointerCancelCapture={focus.onPointerCancelCapture}
    onPointerDownCapture={focus.onPointerDownCapture}
    onPointerMoveCapture={focus.onPointerMoveCapture}
    onPointerUpCapture={focus.onPointerUpCapture}
  ><button type="button" onClick={focus.toggle}>Focus</button></main>
}

function pointer(pointerId: number, clientX: number) {
  return {
    clientX,
    clientY: 0,
    currentTarget: { ownerDocument: { defaultView: null } },
    pointerId,
    pointerType: 'touch',
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target: {}
  }
}
