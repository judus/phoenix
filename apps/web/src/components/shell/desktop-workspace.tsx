import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import type { ApplicationNavigationItem, NavigationItem } from '@phoenix/ui'
import type { Deskplane, DeskplaneSnapshot } from 'deskplane'
import { DeskplaneViewport } from 'deskplane/react'
import { emptyContextItems, primaryItems } from './navigation-model.js'
import { InformationWorkspace } from './information-workspace.js'
import { UtilityWorkspacePage, WorkspacePage } from './workspace-page.js'
import { DeskplaneRouteSynchronizer } from './deskplane-route-synchronizer.js'
import type { InformationRoute, PhoenixRoute, PhoenixWorkspace } from '../../application/navigation/phoenix-route.js'

export interface DesktopWorkspaceProps {
  activeDesktop: PhoenixWorkspace
  controls: ReactNode
  controlsContextItems?: ApplicationNavigationItem[]
  controlsCurrentContext?: string
  onControlsContextAction?: (item: ApplicationNavigationItem) => void
  copilot: ReactNode
  copilotContextItems?: NavigationItem[]
  copilotCurrentContext?: string
  information: ReactNode
  informationContextItems?: NavigationItem[]
  informationContextLabel?: string
  informationCurrentContext?: string
  journal: ReactNode
  journalContextItems?: NavigationItem[]
  journalCurrentContext?: string
  macros: ReactNode
  informationRoute: InformationRoute
  onNavigateRoute: (route: PhoenixRoute) => void
  onNavigateWorkspace: (desktop: PhoenixWorkspace) => void
  settings: ReactNode
  settingsContextItems?: NavigationItem[]
  settingsCurrentContext?: string
  telemetry: ReactNode
  telemetryContextItems?: NavigationItem[]
  telemetryCurrentContext?: string
}

export function DesktopWorkspace({
  activeDesktop,
  controls,
  controlsContextItems = emptyContextItems,
  controlsCurrentContext = '',
  copilot,
  copilotContextItems = emptyContextItems,
  copilotCurrentContext = '',
  information,
  informationContextItems = emptyContextItems,
  informationContextLabel = 'Contextual navigation',
  informationCurrentContext = '',
  informationRoute,
  journal,
  journalContextItems = emptyContextItems,
  journalCurrentContext = '',
  macros,
  onControlsContextAction,
  onNavigateRoute,
  onNavigateWorkspace,
  settings,
  settingsContextItems = emptyContextItems,
  settingsCurrentContext = '',
  telemetry,
  telemetryContextItems = emptyContextItems,
  telemetryCurrentContext = ''
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
            {
              id: 'telemetry',
              ariaLabel: 'Numpad workspace',
              children: (
                <WorkspacePage
                  contextItems={telemetryContextItems}
                  contextLabel="Numpad views"
                  currentContext={telemetryCurrentContext}
                  onNavigate={onNavigateRoute}
                >
                  {telemetry}
                </WorkspacePage>
              )
            },
            utilityDesktop('macros', 'Macros workspace', macros),
            {
              id: 'journal',
              ariaLabel: 'Log workspace',
              children: (
                <WorkspacePage
                  contextItems={journalContextItems}
                  contextLabel="Log views"
                  currentContext={journalCurrentContext}
                  onNavigate={onNavigateRoute}
                >
                  {journal}
                </WorkspacePage>
              )
            }
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
                  contextItems={controlsContextItems}
                  contextLabel="Controls views"
                  currentContext={controlsCurrentContext}
                  onAction={onControlsContextAction}
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
                  currentContext={informationCurrentContext}
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
                  contextItems={copilotContextItems}
                  contextLabel="Copilot views"
                  currentContext={copilotCurrentContext}
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
          initialDesktopId: 'settings',
          desktops: [
            {
              id: 'settings',
              ariaLabel: 'Settings workspace',
              children: (
                <WorkspacePage
                  contextItems={settingsContextItems}
                  contextLabel="Settings views"
                  currentContext={settingsCurrentContext}
                  onNavigate={onNavigateRoute}
                >
                  {settings}
                </WorkspacePage>
              )
            }
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
