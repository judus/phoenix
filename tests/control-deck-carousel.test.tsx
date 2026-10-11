import { act } from 'react-test-renderer'
import { afterEach, expect, test, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { ControlsDeckCarousel } from '../apps/web/src/features/controls/controls-deck-carousel.js'
import { ControlSurface } from '../apps/web/src/features/controls/control-surface.js'
import { DEFAULT_CONTROL_DECK_CONFIGURATION } from '../apps/server/src/infrastructure/default-control-deck-configuration.js'
import { renderWithAct } from './support/render-with-act.js'

afterEach(() => vi.useRealTimers())
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

function props(): ComponentProps<typeof ControlsDeckCarousel> {
  return {
    deckId: 'ship', controller: { status: 'ready', configuration: DEFAULT_CONTROL_DECK_CONFIGURATION },
    editing: false, variableFontSizes: true,
    macros: { library: { version: 1, macros: [] }, abort: vi.fn(), cancelRecording: vi.fn(), deleteMacro: vi.fn(),
      play: vi.fn(), recordAction: vi.fn(), save: vi.fn(), startRecording: vi.fn(), stopRecording: vi.fn() },
    onEditingChange: vi.fn(), onExecuteAction: vi.fn(), onExecuteNavigation: vi.fn(),
    onSaveConfiguration: async configuration => configuration, onSelectDeck: vi.fn()
  }
}

test('only the current deck and its neighbours render; previews have no activation handlers', async () => {
  const input = props()
  const renderer = await renderWithAct(<ControlsDeckCarousel {...input} />)
  try {
    const pages = renderer.root.findAllByProps({ className: 'deck-slide' })
    expect(pages.map(page => [page.findByType(ControlSurface).props.deck.id, Boolean(page.props.inert)])).toEqual([['quick', true], ['ship', false], ['combat', true]])
    for (const page of pages.filter(page => page.props.inert)) {
      expect(page.findByType('main').props.inert).toBe(true)
      for (const button of page.findAllByType('button')) {
        expect(button.props.onClick).toBeUndefined()
        expect(button.props.onPointerDown).toBeUndefined()
      }
    }
    await act(async () => renderer.update(<ControlsDeckCarousel {...input} deckId="quick" />))
    expect(renderer.root.findAllByType(ControlSurface).map(page => page.props.deck.id)).toEqual(['quick', 'ship'])
    const configuration = { ...DEFAULT_CONTROL_DECK_CONFIGURATION, decks: [...DEFAULT_CONTROL_DECK_CONFIGURATION.decks].reverse() }
    await act(async () => renderer.update(<ControlsDeckCarousel {...input} controller={{ status: 'ready', configuration }} deckId="combat" />))
    expect(renderer.root.findAllByType(ControlSurface).map(page => page.props.deck.id)).toEqual(['navigation', 'combat', 'ship'])
    await act(async () => renderer.update(<ControlsDeckCarousel {...input} editing />))
    expect(renderer.root.findAllByType(ControlSurface)).toHaveLength(1)
    expect(renderer.root.findAllByProps({ className: 'deck-carousel' })).toHaveLength(0)
  } finally { await act(async () => renderer.unmount()) }
})

// Window listeners exercise the real hook with deterministic gesture time/geometry.
class Pointer extends Event {
  constructor(type: string, init: Partial<PointerEvent> = {}) {
    super(type, { cancelable: true })
    Object.defineProperties(this, Object.fromEntries(Object.entries({ pointerId: 1, isPrimary: true, button: 0,
      clientX: 200, clientY: 300, timeStamp: 1000, pointerType: 'touch', ...init }).map(([key, value]) => [key, { value }])))
  }
}

async function gestureFixture() {
  vi.useFakeTimers()
  const view = Object.assign(new EventTarget(), { PointerEvent: Pointer, matchMedia: () => ({ matches: false }) })
  const classes = new Set<string>()
  const strip = { style: { transform: '' }, classList: { add: (value: string) => classes.add(value), remove: (value: string) => classes.delete(value) } }
  const viewport = { ownerDocument: { defaultView: view }, contains: () => true, getBoundingClientRect: () => ({ height: 600 }) }
  const input = props()
  const renderer = await renderWithAct(<ControlsDeckCarousel {...input} />, {
    createNodeMock: element => {
      const { className } = element.props as { className?: string }
      return className === 'deck-carousel' ? viewport : className === 'deck-strip' ? strip : null
    }
  })
  const target = { closest: (selector: string) => selector === 'button' ? { hasAttribute: () => true } : null }
  const dispatch = async (type: string, values: Partial<PointerEvent> = {}, origin = target) => {
    const event = new Pointer(type, values)
    Object.defineProperty(event, 'target', { value: origin })
    await act(async () => { view.dispatchEvent(event) })
    return event
  }
  return { view, strip, renderer, input, dispatch, classes }
}

test('vertical movement follows the finger, cancels the outer candidate and commits only after snapping', async () => {
  const f = await gestureFixture()
  const cancelled: number[] = []
  f.view.addEventListener('pointercancel', event => cancelled.push((event as PointerEvent).pointerId))
  try {
    await f.dispatch('pointerdown')
    const move = await f.dispatch('pointermove', { clientX: 215, clientY: 150, timeStamp: 1400 })
    expect(move.defaultPrevented).toBe(true)
    expect(cancelled).toEqual([1])
    expect(f.strip.style.transform).toBe('translateY(-150px)')
    expect(f.input.onSelectDeck).not.toHaveBeenCalled()
    await f.dispatch('pointerup', { clientY: 150, timeStamp: 1600 })
    expect(f.strip.style.transform).toBe('translateY(-600px)')
    expect(f.classes.has('settling')).toBe(true)
    await act(async () => { vi.advanceTimersByTime(320) })
    expect(f.input.onSelectDeck).toHaveBeenCalledExactlyOnceWith('combat')
    expect(f.strip.style.transform).toBe('translateY(0px)')
  } finally { await act(async () => f.renderer.unmount()) }
})

test('short drags snap back, horizontal drags stay with Deskplane and hold controls do not start swipes', async () => {
  const f = await gestureFixture()
  try {
    await f.dispatch('pointerdown')
    await f.dispatch('pointermove', { clientY: 280, timeStamp: 1400 })
    await f.dispatch('pointerup', { clientY: 280, timeStamp: 1600 })
    await act(async () => { vi.advanceTimersByTime(320) })
    expect(f.input.onSelectDeck).not.toHaveBeenCalled()
    await f.dispatch('pointerdown')
    const horizontal = await f.dispatch('pointermove', { clientX: 70, clientY: 315 })
    expect(horizontal.defaultPrevented).toBe(false)
    expect(f.strip.style.transform).toBe('translateY(0px)')
    await f.dispatch('pointerup')
    const hold = { closest: (selector: string) => selector === 'button' ? { hasAttribute: () => false } : null }
    await f.dispatch('pointerdown', {}, hold)
    await f.dispatch('pointermove', { clientY: 100 })
    expect(f.strip.style.transform).toBe('translateY(0px)')
    expect(f.input.onSelectDeck).not.toHaveBeenCalled()
  } finally { await act(async () => f.renderer.unmount()) }
})

test('cancelling a drag or navigating elsewhere prevents a delayed deck change', async () => {
  const f = await gestureFixture()
  try {
    await f.dispatch('pointerdown')
    await f.dispatch('pointermove', { clientY: 100 })
    await f.dispatch('pointercancel')
    await act(async () => { vi.advanceTimersByTime(320) })
    expect(f.input.onSelectDeck).not.toHaveBeenCalled()
    await f.dispatch('pointerdown')
    await f.dispatch('pointermove', { clientY: 100 })
    await f.dispatch('pointerup')
    await act(async () => f.renderer.update(<ControlsDeckCarousel {...f.input} deckId="navigation" />))
    await act(async () => { vi.advanceTimersByTime(320) })
    expect(f.input.onSelectDeck).not.toHaveBeenCalled()
  } finally { await act(async () => f.renderer.unmount()) }
})

test('first-deck overscroll resists and never wraps; pointer clicks after a swipe are suppressed, keyboard clicks are not', async () => {
  const f = await gestureFixture()
  try {
    await act(async () => f.renderer.update(<ControlsDeckCarousel {...f.input} deckId="quick" />))
    await f.dispatch('pointerdown')
    await f.dispatch('pointermove', { clientY: 500 })
    expect(f.strip.style.transform).toBe('translateY(40px)')
    await f.dispatch('pointerup')
    const keyboard = new Pointer('click', { detail: 0 })
    const pointer = new Pointer('click', { detail: 1 })
    f.view.dispatchEvent(keyboard)
    f.view.dispatchEvent(pointer)
    expect(keyboard.defaultPrevented).toBe(false)
    expect(pointer.defaultPrevented).toBe(true)
    await act(async () => { vi.advanceTimersByTime(320) })
    expect(f.input.onSelectDeck).not.toHaveBeenCalled()
    expect(f.strip.style.transform).toBe('translateY(0px)')
  } finally { await act(async () => f.renderer.unmount()) }
})
