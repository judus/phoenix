import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

type Drag = { id: string, pointerId: number, startY: number, startScroll: number, moved: boolean }
type Preview = { id: string, offset: number, target?: string }

/** List reordering is a draft edit, separate from grid-button placement/swapping. */
export function useDeckReorder(ids: string[], enabled: boolean, onMove: (from: number, to: number) => void) {
  const list = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | undefined>(undefined)
  const [preview, setPreview] = useState<Preview>()
  const pointerY = useRef(0)
  const pointerX = useRef(0)
  const cancel = () => { drag.current = undefined; setPreview(undefined) }
  const order = ids.join('|')

  const targetAt = (x: number, y: number) => {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-deck-id]')
    return target && list.current?.contains(target) ? target.dataset.deckId : undefined
  }

  useEffect(() => {
    cancel()
    if (typeof window === 'undefined') return
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') cancel() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [enabled, order])

  // Keep a long list scrollable even when the finger pauses at its edge.
  useEffect(() => {
    if (!preview) return
    let frame: number
    const scroll = () => {
      const surface = list.current
      const current = drag.current
      if (!surface || !current) return
      const rect = surface.getBoundingClientRect()
      const y = pointerY.current
      if (y >= rect.top && y <= rect.bottom) {
        const delta = y < rect.top + 48 ? -8 : y > rect.bottom - 48 ? 8 : 0
        if (delta) {
          surface.scrollTop += delta
          setPreview(value => value && { ...value, offset: y - current.startY + surface.scrollTop - current.startScroll,
            target: targetAt(pointerX.current, y) })
        }
      }
      frame = requestAnimationFrame(scroll)
    }
    frame = requestAnimationFrame(scroll)
    return () => cancelAnimationFrame(frame)
  }, [preview?.id])

  return {
    list, preview, cancel,
    begin(event: PointerEvent<HTMLElement>, id: string) {
      if (!enabled || !event.isPrimary || event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = { id, pointerId: event.pointerId, startY: event.clientY, startScroll: list.current!.scrollTop, moved: false }
      pointerY.current = event.clientY
      pointerX.current = event.clientX
    },
    keyboard(event: KeyboardEvent<HTMLElement>, index: number) {
      if (!enabled || !['ArrowUp', 'ArrowDown'].includes(event.key)) return
      event.preventDefault()
      const to = index + (event.key === 'ArrowUp' ? -1 : 1)
      if (to >= 0 && to < ids.length) onMove(index, to)
    },
    events: {
      onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        pointerY.current = event.clientY
        pointerX.current = event.clientX
        const offset = event.clientY - current.startY + list.current!.scrollTop - current.startScroll
        if (Math.abs(offset) < 6 && !current.moved) return
        current.moved = true
        setPreview({ id: current.id, offset, target: targetAt(event.clientX, event.clientY) })
      },
      onPointerUp(event: PointerEvent<HTMLDivElement>) {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        const target = current.moved && targetAt(event.clientX, event.clientY)
        cancel()
        if (target && target !== current.id) onMove(ids.indexOf(current.id), ids.indexOf(target))
      },
      onPointerCancel: cancel,
      onLostPointerCapture: cancel
    }
  }
}
