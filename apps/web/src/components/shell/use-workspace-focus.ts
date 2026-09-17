import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

interface FocusGestureState {
  blocked: boolean
  handled: boolean
  initialDistance?: number
  invalid: boolean
  points: Map<number, { blocked: boolean, x: number, y: number }>
}

export interface WorkspaceFocus {
  active: boolean
  onClickCapture(event: ReactMouseEvent<HTMLElement>): void
  onPointerCancelCapture(event: ReactPointerEvent<HTMLElement>): void
  onPointerDownCapture(event: ReactPointerEvent<HTMLElement>): void
  onPointerMoveCapture(event: ReactPointerEvent<HTMLElement>): void
  onPointerUpCapture(event: ReactPointerEvent<HTMLElement>): void
  setActive(active: boolean): void
  toggle(): void
}

export function useWorkspaceFocus(): WorkspaceFocus {
  const [active, setActive] = useState(false)
  const gesture = useRef<FocusGestureState>(createFocusGestureState())
  const suppressClicksUntil = useRef(0)

  useEffect(() => {
    if (!active || typeof globalThis.addEventListener !== 'function') return
    const exit = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setActive(false)
    }
    globalThis.addEventListener('keydown', exit)
    return () => globalThis.removeEventListener('keydown', exit)
  }, [active])

  const update = (event: ReactPointerEvent<HTMLElement>, phase: 'down' | 'move' | 'up') => {
    if (event.pointerType !== 'touch') return
    const state = gesture.current
    if (phase === 'down') {
      state.points.set(event.pointerId, {
        blocked: blockedTarget(event.target),
        x: event.clientX,
        y: event.clientY
      })
      if (state.points.size > 2) {
        state.invalid = true
        state.initialDistance = undefined
      } else if (state.points.size === 2 && !state.invalid) {
        state.initialDistance = distance(state.points)
        state.blocked = [...state.points.values()].some(point => point.blocked)
        state.handled = false
        cancelSinglePointerGesture(event, state.points.keys().next().value)
      }
      return
    }
    const point = state.points.get(event.pointerId)
    if (!point) return
    if (phase === 'move') {
      point.x = event.clientX
      point.y = event.clientY
      if (state.points.size !== 2 || state.invalid || state.blocked || state.handled || !state.initialDistance) return
      const ratio = distance(state.points) / state.initialDistance
      const enter = !active && ratio >= 1.2
      const exit = active && ratio <= 0.8
      if (!enter && !exit) return
      state.handled = true
      suppressClicksUntil.current = Date.now() + 750
      event.preventDefault()
      setActive(enter)
      return
    }
    if (state.handled) {
      suppressClicksUntil.current = Date.now() + 750
      event.preventDefault()
    }
    state.points.delete(event.pointerId)
    if (state.points.size < 2) {
      state.initialDistance = undefined
      state.blocked = false
      state.handled = false
    }
    if (state.points.size === 0) state.invalid = false
  }

  return {
    active,
    onClickCapture: event => {
      if (Date.now() >= suppressClicksUntil.current) return
      event.preventDefault()
      event.stopPropagation()
    },
    onPointerCancelCapture: event => update(event, 'up'),
    onPointerDownCapture: event => update(event, 'down'),
    onPointerMoveCapture: event => update(event, 'move'),
    onPointerUpCapture: event => update(event, 'up'),
    setActive,
    toggle: () => setActive(current => !current)
  }
}

function createFocusGestureState(): FocusGestureState {
  return { blocked: false, handled: false, invalid: false, points: new Map() }
}

function distance(points: FocusGestureState['points']): number {
  const [first, second] = [...points.values()]
  if (!first || !second) return 0
  return Math.hypot(second.x - first.x, second.y - first.y)
}

function blockedTarget(target: EventTarget | null): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false
  return Boolean(target.closest('input, select, textarea, [contenteditable="true"], [data-control-deck-activation="hold"], [data-deskplane-no-swipe]'))
}

function cancelSinglePointerGesture(event: ReactPointerEvent<HTMLElement>, pointerId: number | undefined): void {
  if (pointerId === undefined) return
  const view = event.currentTarget.ownerDocument.defaultView
  if (!view || typeof view.PointerEvent !== 'function') return
  view.dispatchEvent(new view.PointerEvent('pointercancel', {
    bubbles: true,
    isPrimary: true,
    pointerId,
    pointerType: 'touch'
  }))
}
