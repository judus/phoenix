import { act, create } from 'react-test-renderer'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useButtonMove } from '../apps/web/src/features/controls/use-button-move.js'

class Slot {
  dataset: { moveSlot: string }
  constructor(slot: string) { this.dataset = { moveSlot: slot } }
  closest() { return this }
}
let move: ReturnType<typeof useButtonMove>
let renderer: ReturnType<typeof create>
const onMove = vi.fn()
let hit: Slot | null
const revision = {}
function Harness({ enabled = true, version = revision }) {
  move = useButtonMove(enabled, version, onMove)
  return <div ref={move.surface} />
}
const pointer = (x = 0, y = 0) => ({ pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y, currentTarget: { setPointerCapture: vi.fn(), parentElement: { getBoundingClientRect: () => ({ left: 50, top: 60, width: 120, height: 100 }) } } }) as any
const click = (target: Slot, detail = 0) => ({ target, detail, preventDefault: vi.fn(), stopPropagation: vi.fn() }) as any

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  onMove.mockClear()
  hit = new Slot('2:1')
  vi.stubGlobal('Element', Slot)
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('document', { elementFromPoint: () => hit })
  await act(async () => { renderer = create(<Harness />, { createNodeMock: () => ({ contains: (node: unknown) => node instanceof Slot, getBoundingClientRect: () => ({ left: 20, top: 30 }) }) }) })
})
afterEach(async () => { await act(async () => renderer.unmount()); vi.unstubAllGlobals() })

test('pointer drag commits exactly once and suppresses its following click', async () => {
  await act(async () => move.begin(pointer(), 'a', '1:1'))
  await act(async () => move.events.onPointerMove(pointer(30)))
  expect(move.sourceSlot).toBe('1:1')
  expect(move.destination).toBe('2:1')
  await act(async () => move.events.onPointerUp(pointer(30)))
  expect(onMove).toHaveBeenCalledExactlyOnceWith('a', 2, 1)
  const event = click(hit!, 1)
  move.events.onClickCapture(event)
  expect(event.stopPropagation).toHaveBeenCalled()
  expect(move.sourceSlot).toBeUndefined()
})

test('tap or keyboard selection can move without dragging and same-slot cancels', async () => {
  await act(async () => move.select('a', '1:1'))
  await act(async () => move.events.onClickCapture(click(new Slot('1:1'))))
  expect(onMove).not.toHaveBeenCalled()
  await act(async () => move.select('a', '1:1'))
  const event = click(hit!)
  await act(async () => move.events.onClickCapture(event))
  expect(event.stopPropagation).toHaveBeenCalled()
  expect(onMove).toHaveBeenCalledExactlyOnceWith('a', 2, 1)
})

test('short movements and drops outside the surface do not move a command', async () => {
  await act(async () => move.begin(pointer(), 'a', '1:1'))
  expect(move.preview).toEqual({ id: 'a', slot: '1:1', left: 30, top: 30, width: 120, height: 100, x: 0, y: 0 })
  await act(async () => move.events.onPointerMove(pointer(2)))
  expect(move.preview?.x).toBe(2)
  await act(async () => move.events.onPointerUp(pointer(2)))
  expect(move.preview).toBeUndefined()
  expect(onMove).not.toHaveBeenCalled()
  await act(async () => move.begin(pointer(), 'a', '1:1'))
  await act(async () => move.events.onPointerMove(pointer(30)))
  hit = null
  await act(async () => move.events.onPointerUp(pointer(30)))
  expect(move.sourceSlot).toBeUndefined()
  expect(onMove).not.toHaveBeenCalled()
})

test('cancel, escape, a second touch, configuration change and edit exit cancel a pending move', async () => {
  const cancels = [
    () => move.events.onPointerCancel(),
    () => { const event = new Event('keydown'); Object.assign(event, { key: 'Escape' }); window.dispatchEvent(event) },
    () => { const event = new Event('pointerdown'); Object.assign(event, { isPrimary: false }); window.dispatchEvent(event) },
    () => renderer.update(<Harness version={{}} />),
    () => renderer.update(<Harness enabled={false} />)
  ]
  for (const cancel of cancels) {
    await act(async () => move.begin(pointer(), 'a', '1:1'))
    await act(async () => move.events.onPointerMove(pointer(30)))
    expect(move.sourceSlot).toBe('1:1')
    expect(move.destination).toBe('2:1')
    await act(async () => cancel())
    await act(async () => move.events.onPointerUp(pointer(30)))
    expect(move.sourceSlot).toBeUndefined()
    expect(move.preview).toBeUndefined()
  }
  expect(onMove).not.toHaveBeenCalled()
})
