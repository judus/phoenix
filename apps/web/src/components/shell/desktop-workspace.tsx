import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { NavigationItem } from '@phoenix/ui'
import type { Deskplane, DeskplaneSnapshot } from 'deskplane'
import { DeskplaneViewport } from 'deskplane/react'
import { contextForInformationRoute, contextItems, primaryItems } from './navigation-model.js'
import { InformationWorkspace } from './information-workspace.js'
import { UtilityWorkspacePage, WorkspacePage } from './workspace-page.js'
import { DeskplaneRouteSynchronizer } from './deskplane-route-synchronizer.js'
import type { InformationRoute, PhoenixRoute, PhoenixWorkspace } from '../../application/navigation/phoenix-route.js'

export interface DesktopWorkspaceProps {
  activeDesktop: PhoenixWorkspace
  controls: ReactNode
  copilot: ReactNode
  developer: ReactNode
  information: ReactNode
  informationContextItems?: NavigationItem[]
  informationContextLabel?: string
  informationCurrentContext?: string
  journal: ReactNode
  macros: ReactNode
  informationRoute: InformationRoute
  onNavigateRoute: (route: PhoenixRoute) => void
  onNavigateWorkspace: (desktop: PhoenixWorkspace) => void
  settings: ReactNode
  telemetry: ReactNode
}

export function DesktopWorkspace({
  activeDesktop,
  controls,
  copilot,
  developer,
  information,
  informationContextItems = contextItems,
  informationContextLabel = 'Commander views',
  informationCurrentContext,
  informationRoute,
  journal,
  macros,
  onNavigateRoute,
  onNavigateWorkspace,
  settings,
  telemetry
}: DesktopWorkspaceProps) {
  const controller = useRef<Deskplane | null>(null)
  const initialDesktop = useRef(activeDesktop)
  const synchronizer = useRef(new DeskplaneRouteSynchronizer(activeDesktop))
  const onNavigateRef = useRef(onNavigateWorkspace)

  onNavigateRef.current = onNavigateWorkspace

  useEffect(() => {
    const deskplane = controller.current
    if (!deskplane) return
    synchronizer.current.beginRouteSynchronization(activeDesktop)
    void deskplane.goTo(activeDesktop).finally(() => {
      synchronizer.current.finishRouteSynchronization(activeDesktop)
    })
  }, [activeDesktop])

  const handleSnapshotChange = (snapshot: DeskplaneSnapshot): void => {
    const destination = synchronizer.current.receiveDeskplaneSnapshot(snapshot.activeDesktopId)
    if (destination) onNavigateRef.current(destination)
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
                  onNavigate={onNavigateRoute}
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
                  contextItems={informationContextItems}
                  contextLabel={informationContextLabel}
                  currentContext={informationCurrentContext ?? contextForInformationRoute(informationRoute)}
                  currentPrimary={informationRoute.section}
                  onNavigate={onNavigateRoute}
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
                  onNavigate={onNavigateRoute}
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

function utilityDesktop(id: PhoenixWorkspace, ariaLabel: string, children: ReactNode) {
  return {
    id,
    ariaLabel,
    children: <UtilityWorkspacePage>{children}</UtilityWorkspacePage>
  }
}
