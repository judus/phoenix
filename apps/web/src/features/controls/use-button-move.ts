import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react'

type Selection = { id: string, slot: string }
type Drag = Selection & { pointerId: number, x: number, y: number, moved: boolean }

// UI-only gesture state. The runtime owns placement and swap semantics.
export function useButtonMove(enabled: boolean, revision: unknown, onMove: (id: string, column: number, row: number) => void) {
  const surface = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | undefined>(undefined)
  const suppressUntil = useRef(0)
  const [selection, setSelection] = useState<Selection>()
  const [destination, setDestination] = useState<string>()
  const cancel = () => { drag.current = undefined; setSelection(undefined); setDestination(undefined) }

  useEffect(() => {
    cancel()
    if (!enabled || typeof window === 'undefined') return
    const keyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel() }
    const pointerDown = (event: globalThis.PointerEvent) => {
      if (!event.isPrimary || !surface.current?.contains(event.target as Node)) cancel()
    }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('pointerdown', pointerDown, true)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('pointerdown', pointerDown, true)
    }
  }, [enabled, revision])

  const slotAt = (target: EventTarget | null) => {
    const slot = target instanceof Element ? target.closest<HTMLElement>('[data-move-slot]') : null
    return slot && surface.current?.contains(slot) ? slot.dataset.moveSlot : undefined
  }
  const drop = (source: Selection, slot: string) => {
    cancel()
    if (source.slot === slot) return
    const [column, row] = slot.split(':').map(Number)
    onMove(source.id, column!, row!)
  }

  return {
    surface,
    sourceSlot: selection?.slot,
    destination,
    begin(event: PointerEvent<HTMLButtonElement>, id: string, slot: string) {
      if (!enabled || !event.isPrimary || event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      drag.current = { id, slot, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false }
    },
    select(id: string, slot: string) {
      setSelection(current => current?.id === id ? undefined : { id, slot })
    },
    events: {
      onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        if (Math.hypot(event.clientX - current.x, event.clientY - current.y) >= 6) current.moved = true
        if (!current.moved) return
        setSelection({ id: current.id, slot: current.slot })
        setDestination(slotAt(document.elementFromPoint(event.clientX, event.clientY)))
      },
      onPointerUp(event: PointerEvent<HTMLDivElement>) {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        drag.current = undefined
        if (!current.moved) return
        suppressUntil.current = Date.now() + 400
        const slot = slotAt(document.elementFromPoint(event.clientX, event.clientY))
        if (slot) drop(current, slot)
        else cancel()
      },
      onPointerCancel() { cancel() },
      onLostPointerCapture() { if (drag.current?.moved) cancel(); drag.current = undefined },
      onClickCapture(event: MouseEvent<HTMLDivElement>) {
        if (event.detail > 0 && Date.now() < suppressUntil.current) {
          event.preventDefault(); event.stopPropagation(); return
        }
        if (!selection) return
        const slot = slotAt(event.target)
        if (!slot) return
        event.preventDefault(); event.stopPropagation()
        drop(selection, slot)
      }
    }
  }
}
