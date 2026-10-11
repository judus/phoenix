import { useRef, type MouseEvent, type PointerEvent } from 'react'

type Point = { x: number, y: number }

/** The scrollable schematic owns touch pan/pinch; short taps still select bodies. */
export function useSchematicPointerGestures(onZoom: (factor: number, anchor: Point) => void) {
  const pointers = useRef(new Map<number, Point>())
  const dragged = useRef(false)
  const movement = useRef(0)

  const point = (event: PointerEvent<HTMLDivElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }
  const capture = (viewport: HTMLDivElement) => {
    for (const id of pointers.current.keys()) viewport.setPointerCapture(id)
  }
  const finish = (event: PointerEvent<HTMLDivElement>) => { pointers.current.delete(event.pointerId) }

  return {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      if (!pointers.current.size) {
        dragged.current = false
        movement.current = 0
      }
      if (event.pointerType !== 'touch') return
      pointers.current.set(event.pointerId, point(event))
      if (pointers.current.size > 1) {
        dragged.current = true
        capture(event.currentTarget)
      }
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const previous = pointers.current.get(event.pointerId)
      if (!previous) return
      const before = [...pointers.current.values()]
      const next = point(event)
      pointers.current.set(event.pointerId, next)
      movement.current += Math.hypot(next.x - previous.x, next.y - previous.y)
      if (!dragged.current) {
        if (movement.current <= 5) return
        dragged.current = true
        capture(event.currentTarget)
      }
      const after = [...pointers.current.values()]
      if (before.length === 2) {
        const distance = Math.hypot(before[0]!.x - before[1]!.x, before[0]!.y - before[1]!.y)
        if (distance > 1) {
          onZoom(Math.hypot(after[0]!.x - after[1]!.x, after[0]!.y - after[1]!.y) / distance,
            { x: (before[0]!.x + before[1]!.x) / 2, y: (before[0]!.y + before[1]!.y) / 2 })
        }
      } else if (before.length === 1) {
        event.currentTarget.scrollLeft -= next.x - previous.x
        event.currentTarget.scrollTop -= next.y - previous.y
      }
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onPointerLeave(event: PointerEvent<HTMLDivElement>) {
      if (!dragged.current) finish(event)
    },
    onLostPointerCapture(event: PointerEvent<HTMLDivElement>) {
      // A child's implicit capture loss bubbles when capture moves to the viewport.
      if (event.target === event.currentTarget) finish(event)
    },
    onClickCapture(event: MouseEvent<HTMLDivElement>) {
      if (dragged.current && event.detail !== 0) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
  }
}
