import { useEffect, useRef, type ReactNode } from 'react'
import type { Deskplane, DeskplaneSnapshot } from 'deskplane'
import { DeskplaneViewport } from 'deskplane/react'

export type DesktopMode = 'controls' | 'information' | 'copilot'

export interface DesktopWorkspaceProps {
  activeMode: DesktopMode
  controls: ReactNode
  copilot: ReactNode
  information: ReactNode
  onNavigate: (mode: DesktopMode) => void
  topBar: ReactNode
}

const TRANSITION = {
  duration: 220,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
} as const

export function DesktopWorkspace ({
  activeMode,
  controls,
  copilot,
  information,
  onNavigate,
  topBar
}: DesktopWorkspaceProps) {
  const controller = useRef<Deskplane | null>(null)
  const initialMode = useRef(activeMode)
  const activeModeRef = useRef(activeMode)
  const onNavigateRef = useRef(onNavigate)
  activeModeRef.current = activeMode
  onNavigateRef.current = onNavigate

  useEffect(() => {
    void controller.current?.goTo(activeMode)
  }, [activeMode])

  const handleSnapshotChange = (snapshot: DeskplaneSnapshot): void => {
    const mode = snapshot.activeDesktopId as DesktopMode
    if (mode !== activeModeRef.current) onNavigateRef.current(mode)
  }

  return (
    <div className={`desktop-workspace desktop-workspace--${activeMode}`}>
      <div className="desktop-workspace__top-bar">{topBar}</div>
      <DeskplaneViewport
        aria-label="PHOENIX desktop workspace"
        className="desktop-workspace__viewport"
        initialDesktopId={initialMode.current}
        onReady={deskplane => {
          controller.current = deskplane
          return () => {
            if (controller.current === deskplane) controller.current = null
          }
        }}
        onSnapshotChange={handleSnapshotChange}
        rows={[{
          id: 'primary',
          desktops: [
            {
              id: 'controls',
              ariaLabel: 'Controls desktop',
              className: 'desktop-workspace__desktop desktop-workspace__desktop--controls',
              children: <DesktopSurface edges="right">{controls}</DesktopSurface>
            },
            {
              id: 'information',
              ariaLabel: 'Information desktop',
              className: 'desktop-workspace__desktop desktop-workspace__desktop--information',
              children: <DesktopSurface edges="both">{information}</DesktopSurface>
            },
            {
              id: 'copilot',
              ariaLabel: 'Copilot desktop',
              className: 'desktop-workspace__desktop desktop-workspace__desktop--copilot',
              children: <DesktopSurface edges="left">{copilot}</DesktopSurface>
            }
          ]
        }]}
        transition={TRANSITION}
      />
      <nav className="desktop-workspace__switcher" aria-label="PHOENIX desktops">
        <DesktopButton active={activeMode === 'controls'} label="Controls" onClick={() => onNavigate('controls')} />
        <DesktopButton active={activeMode === 'information'} label="Info" onClick={() => onNavigate('information')} />
        <DesktopButton active={activeMode === 'copilot'} label="Copilot" onClick={() => onNavigate('copilot')} />
      </nav>
    </div>
  )
}

function DesktopSurface ({
  children,
  edges
}: {
  children: ReactNode
  edges: 'both' | 'left' | 'right'
}) {
  return (
    <div className="desktop-workspace__surface">
      {children}
      {edges !== 'right' && <div aria-hidden="true" className="desktop-workspace__swipe-zone desktop-workspace__swipe-zone--left" data-deskplane-swipe-zone="horizontal" />}
      {edges !== 'left' && <div aria-hidden="true" className="desktop-workspace__swipe-zone desktop-workspace__swipe-zone--right" data-deskplane-swipe-zone="horizontal" />}
    </div>
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
