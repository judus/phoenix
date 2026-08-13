import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'

export type DesktopMode = 'controls' | 'information' | 'copilot'

export interface DesktopWorkspaceProps {
  activeMode: DesktopMode
  controls: ReactNode
  copilot: ReactNode
  information: ReactNode
  onNavigate: (mode: DesktopMode) => void
  topBar: ReactNode
}

const MODE_INDEX: Record<DesktopMode, number> = {
  controls: 0,
  information: 1,
  copilot: 2
}

export function DesktopWorkspace ({
  activeMode,
  controls,
  copilot,
  information,
  onNavigate,
  topBar
}: DesktopWorkspaceProps) {
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const gesture = useRef<{
    pointerId: number
    startX: number
    target: DesktopMode
    direction: -1 | 1
  } | undefined>(undefined)
  const targetIndex = MODE_INDEX[activeMode]
  const [visualIndex, setVisualIndex] = useState(targetIndex)
  const [transitioning, setTransitioning] = useState(false)

  useLayoutEffect(() => {
    if (targetIndex === visualIndex) return
    setTransitioning(true)
    const frame = window.requestAnimationFrame(() => setVisualIndex(targetIndex))
    return () => window.cancelAnimationFrame(frame)
  }, [targetIndex, visualIndex])

  useEffect(() => {
    if (!transitioning || visualIndex !== targetIndex) return
    const timeout = window.setTimeout(() => setTransitioning(false), 200)
    return () => window.clearTimeout(timeout)
  }, [targetIndex, transitioning, visualIndex])

  const beginGesture = (event: PointerEvent<HTMLDivElement>): void => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const offset = event.clientX - bounds.left
    const atLeftEdge = offset <= 32
    const atRightEdge = offset >= bounds.width - 32
    const destination = activeMode === 'information' && atLeftEdge
      ? { direction: 1 as const, target: 'controls' as const }
      : activeMode === 'information' && atRightEdge
        ? { direction: -1 as const, target: 'copilot' as const }
        : activeMode === 'controls' && atRightEdge
          ? { direction: -1 as const, target: 'information' as const }
          : activeMode === 'copilot' && atLeftEdge
            ? { direction: 1 as const, target: 'information' as const }
            : undefined
    if (!destination) return
    event.preventDefault()
    setDragging(true)
    gesture.current = {
      direction: destination.direction,
      pointerId: event.pointerId,
      startX: event.clientX,
      target: destination.target
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveGesture = (event: PointerEvent<HTMLDivElement>): void => {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    const delta = event.clientX - current.startX
    setDragOffset(current.direction === Math.sign(delta) ? delta : delta * 0.15)
  }

  const endGesture = (event: PointerEvent<HTMLDivElement>): void => {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    const delta = event.clientX - current.startX
    const threshold = Math.min(120, Math.max(56, window.innerWidth * 0.1))
    gesture.current = undefined
    setDragging(false)
    setDragOffset(0)
    if (Math.abs(delta) >= threshold && current.direction === Math.sign(delta)) {
      onNavigate(current.target)
    }
  }

  const cancelGesture = (): void => {
    gesture.current = undefined
    setDragging(false)
    setDragOffset(0)
  }

  return (
    <div className={`desktop-workspace desktop-workspace--${activeMode}`}>
      <div className="desktop-workspace__top-bar">{topBar}</div>
      <div
        className={`desktop-workspace__viewport${dragging ? ' is-dragging' : ''}`}
        onPointerCancel={cancelGesture}
        onPointerDown={beginGesture}
        onPointerMove={moveGesture}
        onPointerUp={endGesture}
      >
        <Desktop active={activeMode === 'controls'} dragOffset={dragOffset} mode="controls" position={0 - visualIndex} visible={activeMode === 'controls' || dragging || transitioning}>{controls}</Desktop>
        <Desktop active={activeMode === 'information'} dragOffset={dragOffset} mode="information" position={1 - visualIndex} visible={activeMode === 'information' || dragging || transitioning}>{information}</Desktop>
        <Desktop active={activeMode === 'copilot'} dragOffset={dragOffset} mode="copilot" position={2 - visualIndex} visible={activeMode === 'copilot' || dragging || transitioning}>{copilot}</Desktop>
      </div>
      <nav className="desktop-workspace__switcher" aria-label="PHOENIX desktops">
        <DesktopButton active={activeMode === 'controls'} label="Controls" onClick={() => onNavigate('controls')} />
        <DesktopButton active={activeMode === 'information'} label="Info" onClick={() => onNavigate('information')} />
        <DesktopButton active={activeMode === 'copilot'} label="Copilot" onClick={() => onNavigate('copilot')} />
      </nav>
    </div>
  )
}

function Desktop ({
  active,
  children,
  dragOffset,
  mode,
  position,
  visible
}: {
  active: boolean
  children: ReactNode
  dragOffset: number
  mode: DesktopMode
  position: number
  visible: boolean
}) {
  return (
    <section
      aria-hidden={!active}
      className={`desktop-workspace__desktop desktop-workspace__desktop--${mode}`}
      hidden={!visible}
      inert={!active}
      style={{ transform: `translate3d(calc(${position * 100}% + ${dragOffset}px), 0, 0)` }}
    >
      {children}
    </section>
  )
}

interface DesktopButtonProps {
  active: boolean
  label: string
  onClick: () => void
}

function DesktopButton ({
  active,
  label,
  onClick
}: DesktopButtonProps) {
  return (
    <button
      aria-label={`Open ${label} desktop`}
      aria-pressed={active}
      className="desktop-workspace__switcher-button"
      onClick={onClick}
      title={`Open ${label}`}
      type="button"
    >
      {label}
    </button>
  )
}
