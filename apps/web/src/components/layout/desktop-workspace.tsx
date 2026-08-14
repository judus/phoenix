import { useEffect, useRef, type ReactNode } from 'react'
import type { Deskplane, DeskplaneSnapshot } from 'deskplane'
import { DeskplaneViewport } from 'deskplane/react'

export type DesktopMode = 'controls' | 'information' | 'copilot'
export type WorkspaceDesktop = DesktopMode | 'numpad' | 'macros' | 'journal' | 'developer' | 'settings'

export interface DesktopWorkspaceProps {
  activeDesktop: WorkspaceDesktop
  activeMode: DesktopMode
  controls: ReactNode
  copilot: ReactNode
  developer: ReactNode
  information: ReactNode
  journal: ReactNode
  macros: ReactNode
  numpad: ReactNode
  onNavigate: (desktop: WorkspaceDesktop) => void
  settings: ReactNode
  topBar: ReactNode
}

const TRANSITION = {
  duration: 220,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
} as const

export function DesktopWorkspace ({
  activeDesktop,
  activeMode,
  controls,
  copilot,
  developer,
  information,
  journal,
  macros,
  numpad,
  onNavigate,
  settings,
  topBar
}: DesktopWorkspaceProps) {
  const controller = useRef<Deskplane | null>(null)
  const initialDesktop = useRef(activeDesktop)
  const activeDesktopRef = useRef(activeDesktop)
  const programmaticTargetRef = useRef<WorkspaceDesktop | undefined>(undefined)
  const onNavigateRef = useRef(onNavigate)
  activeDesktopRef.current = activeDesktop
  onNavigateRef.current = onNavigate

  useEffect(() => {
    const deskplane = controller.current
    if (!deskplane) return
    programmaticTargetRef.current = activeDesktop
    void deskplane.goTo(activeDesktop).finally(() => {
      if (programmaticTargetRef.current === activeDesktop) programmaticTargetRef.current = undefined
    })
  }, [activeDesktop])

  const handleSnapshotChange = (snapshot: DeskplaneSnapshot): void => {
    const desktop = snapshot.activeDesktopId
    const programmaticTarget = programmaticTargetRef.current
    if (programmaticTarget) {
      if (desktop === programmaticTarget) programmaticTargetRef.current = undefined
      return
    }
    if (isWorkspaceDesktop(desktop) && desktop !== activeDesktopRef.current) onNavigateRef.current(desktop)
  }

  return (
    <div className={`desktop-workspace desktop-workspace--${activeMode}`}>
      <div className="desktop-workspace__top-bar">{topBar}</div>
      <DeskplaneViewport
        aria-label="PHOENIX desktop workspace"
        className="desktop-workspace__viewport"
        initialDesktopId={initialDesktop.current}
        onReady={deskplane => {
          controller.current = deskplane
          return () => {
            if (controller.current === deskplane) controller.current = null
          }
        }}
        onSnapshotChange={handleSnapshotChange}
        rows={[
          {
            id: 'utilities',
            desktops: [
              utilityDesktop('numpad', 'Numpad module', numpad, 'right'),
              utilityDesktop('macros', 'Macro module', macros, 'both'),
              utilityDesktop('journal', 'Journal module', journal, 'both'),
              utilityDesktop('developer', 'Developer module', developer, 'both'),
              utilityDesktop('settings', 'Settings module', settings, 'left')
            ]
          },
          {
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
          }
        ]}
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

function utilityDesktop (
  id: Extract<WorkspaceDesktop, 'numpad' | 'macros' | 'journal' | 'developer' | 'settings'>,
  ariaLabel: string,
  children: ReactNode,
  edges: 'both' | 'left' | 'right'
) {
  return {
    id,
    ariaLabel,
    className: `desktop-workspace__desktop desktop-workspace__desktop--${id}`,
    children: <DesktopSurface edges={edges}>{children}</DesktopSurface>
  }
}

function isWorkspaceDesktop (desktop: string): desktop is WorkspaceDesktop {
  return ['controls', 'information', 'copilot', 'numpad', 'macros', 'journal', 'developer', 'settings'].includes(desktop)
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
