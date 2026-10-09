import { useRef, type Dispatch, type MouseEvent, type PointerEvent, type SetStateAction } from 'react'
import { panAtlas, TOP_DOWN_VIEW, zoomAtlas, type AtlasCamera, type AtlasPoint, type AtlasView } from './galactic-atlas-model.js'

const DRAG_THRESHOLD = 5
const MIN_PINCH_SEPARATION = 1

/** Keep gesture capture on the viewport: markers can disappear as the camera moves. */
export function useAtlasPointerGestures(
  setCamera: Dispatch<SetStateAction<AtlasCamera>>,
  size: { width: number, height: number },
  view: AtlasView = TOP_DOWN_VIEW,
  orbit?: { enabled: boolean, move(delta: AtlasPoint): void }
) {
  const pointers = useRef(new Map<number, AtlasPoint>())
  const movement = useRef(0)
  const dragging = useRef(false)

  function capturePointers(viewport: HTMLDivElement) {
    for (const id of pointers.current.keys()) viewport.setPointerCapture?.(id)
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (!pointers.current.size) {
      movement.current = 0
      dragging.current = false
    }
    pointers.current.set(event.pointerId, localPoint(event))
    if (pointers.current.size > 1) {
      dragging.current = true
      capturePointers(event.currentTarget)
    }
    // Leave a short tap's native target intact so marker click handlers still run.
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const oldPoint = pointers.current.get(event.pointerId)
    if (!oldPoint) return
    const before = [...pointers.current.values()]
    const point = localPoint(event)
    movement.current += Math.hypot(point.x - oldPoint.x, point.y - oldPoint.y)
    pointers.current.set(event.pointerId, point)
    if (!dragging.current) {
      if (movement.current <= DRAG_THRESHOLD) return
      dragging.current = true
      capturePointers(event.currentTarget)
    }

    const after = [...pointers.current.values()]
    const previousCentre = midpoint(before)
    const nextCentre = midpoint(after)
    const delta = { x: nextCentre.x - previousCentre.x, y: nextCentre.y - previousCentre.y }
    if (before.length === 1 && orbit?.enabled) {
      orbit.move(delta)
      return
    }
    setCamera(camera => {
      const zoomed = before.length === 2 && separation(before) > MIN_PINCH_SEPARATION
        ? zoomAtlas(camera, separation(after) / separation(before), previousCentre, size.width, size.height, view)
        : camera
      return panAtlas(zoomed, delta, size.width, size.height, view)
    })
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finishPointer,
    onPointerCancel: finishPointer,
    onPointerLeave(event: PointerEvent<HTMLDivElement>) {
      if (!dragging.current) finishPointer(event)
    },
    onLostPointerCapture(event: PointerEvent<HTMLDivElement>) {
      // Transferring touch's implicit capture from a marker also bubbles a loss event.
      if (event.target === event.currentTarget) finishPointer(event)
    },
    onClickCapture(event: MouseEvent<HTMLDivElement>) {
      if (dragging.current && event.detail !== 0) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
  }
}

function localPoint(event: PointerEvent<HTMLDivElement>): AtlasPoint {
  const rect = event.currentTarget.getBoundingClientRect()
  return { x: event.clientX - rect.left, y: event.clientY - rect.top }
}

function midpoint(points: AtlasPoint[]): AtlasPoint {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length
  }
}

function separation(points: AtlasPoint[]): number {
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
}
