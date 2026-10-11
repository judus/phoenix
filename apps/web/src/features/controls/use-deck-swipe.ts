import { useLayoutEffect, useRef, type RefObject } from 'react'

interface Options {
  viewport: RefObject<HTMLDivElement | null>
  strip: RefObject<HTMLDivElement | null>
  deckId: string
  order: string
  previous?: string
  next?: string
  setBusy(busy: boolean): void
  onSelect(id: string): void
}

/** Own vertical drags only. Deskplane continues to own horizontal workspace gestures. */
export function useDeckSwipe(options: Options) {
  const latest = useRef(options)
  latest.current = options
  useLayoutEffect(() => {
    const viewport = options.viewport.current, strip = options.strip.current
    const view = viewport?.ownerDocument.defaultView
    if (!viewport || !strip || !view) return
    let gesture: { id: number, x: number, y: number, started: number, delta: number, axis?: 'horizontal' | 'vertical' } | undefined
    let settling = false, cancellingOuter = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let suppressClickUntil = 0
    const transform = (offset: number) => { strip.style.transform = `translateY(${offset}px)` }
    const reset = () => {
      gesture = undefined
      settling = false
      strip.classList.remove('settling')
      transform(0)
      latest.current.setBusy(false)
    }
    reset()
    const settle = (cancelled: boolean, finishedAt: number) => {
      if (!gesture || gesture.axis !== 'vertical') { gesture = undefined; return }
      const delta = gesture.delta
      const height = viewport.getBoundingClientRect().height
      const id = delta < 0 ? latest.current.next : latest.current.previous
      const commit = !cancelled && id && (Math.abs(delta) >= height * 0.18 || Math.abs(delta) / Math.max(1, finishedAt - gesture.started) >= 0.5)
      gesture = undefined
      settling = true
      suppressClickUntil = Date.now() + 750
      strip.classList.add('settling')
      transform(commit ? (delta < 0 ? -height : height) : 0)
      const duration = view.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320
      timer = setTimeout(() => {
        reset()
        if (commit) latest.current.onSelect(id)
      }, duration)
    }
    const down = (event: PointerEvent) => {
      if (!event.isPrimary) {
        if (gesture) settle(true, event.timeStamp)
        return
      }
      // A new deliberate tap is not the synthetic click following the previous drag.
      if (event.button === 0) suppressClickUntil = 0
      if (settling || event.button !== 0 || !viewport.contains(event.target as Node)) return
      const target = event.target as Element
      if (target.closest('input, select, textarea, a[href], [contenteditable="true"], [data-deskplane-no-swipe]')) return
      const button = target.closest('button')
      if (button && !button.hasAttribute('data-deskplane-swipe-through')) return
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, started: event.timeStamp, delta: 0 }
    }
    const move = (event: PointerEvent) => {
      if (!gesture || gesture.id !== event.pointerId) return
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y
      if (!gesture.axis && Math.max(Math.abs(dx), Math.abs(dy)) >= 8) {
        gesture.axis = Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal'
        if (gesture.axis === 'vertical') {
          // Cancel the pending outer gesture before its bubble-phase move handler sees drift.
          cancellingOuter = true
          view.dispatchEvent(new view.PointerEvent('pointercancel', { pointerId: event.pointerId, isPrimary: true, pointerType: event.pointerType }))
          cancellingOuter = false
          latest.current.setBusy(true)
        }
      }
      if (gesture.axis !== 'vertical') return
      event.preventDefault()
      gesture.delta = dy
      const neighbour = dy < 0 ? latest.current.next : latest.current.previous
      const height = viewport.getBoundingClientRect().height
      transform(neighbour ? Math.max(-height, Math.min(height, dy)) : dy * 0.2)
    }
    const up = (event: PointerEvent) => {
      if (!gesture || gesture.id !== event.pointerId || cancellingOuter) return
      // Let shell pinch/focus and tile pointer-up cleanup see the completed pointer.
      if (gesture.axis === 'vertical') event.preventDefault()
      settle(event.type === 'pointercancel', event.timeStamp)
    }
    const click = (event: MouseEvent) => {
      if (event.detail === 0 || Date.now() >= suppressClickUntil) return
      event.preventDefault()
      event.stopImmediatePropagation()
      suppressClickUntil = 0
    }
    // Capture precedes Deskplane's window bubble listeners and React button activation.
    view.addEventListener('pointerdown', down, true)
    view.addEventListener('pointermove', move, { capture: true, passive: false })
    view.addEventListener('pointerup', up, true)
    view.addEventListener('pointercancel', up, true)
    view.addEventListener('click', click, true)
    return () => {
      clearTimeout(timer)
      view.removeEventListener('pointerdown', down, true)
      view.removeEventListener('pointermove', move, true)
      view.removeEventListener('pointerup', up, true)
      view.removeEventListener('pointercancel', up, true)
      view.removeEventListener('click', click, true)
      strip.classList.remove('settling')
      transform(0)
    }
  }, [options.deckId, options.order])
}
