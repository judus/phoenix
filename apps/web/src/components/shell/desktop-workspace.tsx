import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { Deskplane, DeskplaneSnapshot } from 'deskplane'
import { DeskplaneViewport } from 'deskplane/react'
import { contextItems, primaryItems } from './navigation-model.js'
import { InformationWorkspace } from './information-workspace.js'
import { UtilityWorkspacePage, WorkspacePage } from './workspace-page.js'
import { isWorkspaceDesktop, type WorkspaceDesktop } from './workspace-desktop.js'

export interface DesktopWorkspaceProps {
  activeDesktop: WorkspaceDesktop
  controls: ReactNode
  copilot: ReactNode
  developer: ReactNode
  information: ReactNode
  journal: ReactNode
  macros: ReactNode
  onNavigate: (desktop: WorkspaceDesktop) => void
  settings: ReactNode
  telemetry: ReactNode
}

export function DesktopWorkspace({
  activeDesktop,
  controls,
  copilot,
  developer,
  information,
  journal,
  macros,
  onNavigate,
  settings,
  telemetry
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
    if (isWorkspaceDesktop(desktop) && desktop !== activeDesktopRef.current) {
      onNavigateRef.current(desktop)
    }
  }

  return (
    <DeskplaneViewport
      aria-label="Application workspaces"
      className="shell-body"
      initialDesktopId={initialDesktop.current}
      onReady={(deskplane) => {
        controller.current = deskplane
        return () => {
          if (controller.current === deskplane) controller.current = null
        }
      }}
      onSnapshotChange={handleSnapshotChange}
      rows={[
        {
          id: 'utilities',
          initialDesktopId: 'telemetry',
          desktops: [
            utilityDesktop('telemetry', 'Telemetry workspace', telemetry),
            utilityDesktop('macros', 'Macros workspace', macros),
            utilityDesktop('journal', 'Journal workspace', journal)
          ]
        },
        {
          id: 'workspaces',
          initialDesktopId: 'info',
          desktops: [
            {
              id: 'controls',
              ariaLabel: 'Controls workspace',
              children: (
                <WorkspacePage
                  contextItems={contextItems}
                  contextLabel="Commander views"
                  currentContext="ship"
                >
                  {controls}
                </WorkspacePage>
              )
            },
            {
              id: 'info',
              ariaLabel: 'Information workspace',
              children: (
                <InformationWorkspace
                  contextItems={contextItems}
                  currentContext="ship"
                  currentPrimary="fleet"
                  primaryItems={primaryItems}
                >
                  {information}
                </InformationWorkspace>
              )
            },
            {
              id: 'copilot',
              ariaLabel: 'Copilot workspace',
              children: (
                <WorkspacePage
                  contextItems={contextItems}
                  contextLabel="Commander views"
                  currentContext="ship"
                >
                  {copilot}
                </WorkspacePage>
              )
            }
          ]
        },
        {
          id: 'system',
          initialDesktopId: 'developer',
          desktops: [
            utilityDesktop('developer', 'Developer workspace', developer),
            utilityDesktop('settings', 'Settings workspace', settings)
          ]
        }
      ]}
    />
  )
}

function utilityDesktop(id: WorkspaceDesktop, ariaLabel: string, children: ReactNode) {
  return {
    id,
    ariaLabel,
    children: <UtilityWorkspacePage>{children}</UtilityWorkspacePage>
  }
}
