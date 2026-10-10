import type { ReactNode } from 'react'
import { ApplicationShell, Navigation, TopBar } from '@phoenix/ui'
import type { ApplicationNavigationItem, NavigationItem } from '@phoenix/ui'
import { DesktopWorkspace } from './desktop-workspace.js'
import { PhoenixBrand } from './phoenix-brand.js'
import { utilityItems, workspaceItems } from './navigation-model.js'
import { useWorkspaceFocus } from './use-workspace-focus.js'
import { useFullscreen } from '../../platform/fullscreen/use-fullscreen.js'
import { isPhoenixWorkspace, type InformationRoute, type PhoenixRoute, type PhoenixWorkspace } from '../../application/navigation/phoenix-route.js'

export interface PhoenixApplicationShellProps {
  activeDesktop: PhoenixWorkspace
  controlsDestination?: PhoenixRoute
  copilotDestination?: PhoenixRoute
  journalDestination?: PhoenixRoute
  controls: ReactNode
  controlsContextItems?: ApplicationNavigationItem[]
  controlsCurrentContext?: string
  copilot: ReactNode
  copilotContextItems?: NavigationItem[]
  copilotCurrentContext?: string
  information: ReactNode
  informationContextItems?: NavigationItem[]
  informationContextLabel?: string
  informationCurrentContext?: string
  journal: ReactNode
  developer?: ReactNode
  showDeveloper?: boolean
  showNumpadButton?: boolean
  developerContextItems?: NavigationItem[]
  developerCurrentContext?: string
  journalContextItems?: NavigationItem[]
  journalCurrentContext?: string
  informationRoute: InformationRoute
  onNavigateRoute: (route: PhoenixRoute) => void
  onControlsContextAction?: (item: ApplicationNavigationItem) => void
  onNavigateWorkspace: (desktop: PhoenixWorkspace) => void
  settings: ReactNode
  settingsContextItems?: NavigationItem[]
  settingsCurrentContext?: string
  telemetry: ReactNode
}

export function PhoenixApplicationShell({
  controlsDestination,
  copilotDestination,
  journalDestination,
  activeDesktop,
  controls,
  controlsContextItems,
  controlsCurrentContext,
  copilot,
  copilotContextItems,
  copilotCurrentContext,
  information,
  informationContextItems,
  informationContextLabel,
  informationCurrentContext,
  informationRoute,
  journal,
  developer,
  showDeveloper = false,
  showNumpadButton = false,
  developerContextItems,
  developerCurrentContext,
  journalContextItems,
  journalCurrentContext,
  onControlsContextAction,
  onNavigateRoute,
  onNavigateWorkspace,
  settings,
  settingsContextItems,
  settingsCurrentContext,
  telemetry
}: PhoenixApplicationShellProps) {
  const fullscreen = useFullscreen()
  const focus = useWorkspaceFocus()
  const androidShell = typeof navigator !== 'undefined' && /\bPhoenixAndroid\//.test(navigator.userAgent)

  return (
    <ApplicationShell
      className={`focus-gesture-enabled${focus.active ? ' focus-mode' : ''}`}
      onClickCapture={focus.onClickCapture}
      onPointerCancelCapture={focus.onPointerCancelCapture}
      onPointerDownCapture={focus.onPointerDownCapture}
      onPointerMoveCapture={focus.onPointerMoveCapture}
      onPointerUpCapture={focus.onPointerUpCapture}
    >
      <TopBar
        brand={<PhoenixBrand />}
        utilities={
          <Navigation
            variant="compact"
            label="Workspaces"
            current={activeDesktop}
            items={[
              ...workspaceItems(informationRoute, controlsDestination, copilotDestination, journalDestination, { showDeveloper, showNumpadButton }),
              ...utilityItems(fullscreen, focus.active, androidShell)
            ]}
            onItemSelect={(item) => {
              if (item.id === 'reload') {
                location.reload()
                return
              }
              if (item.id === 'fullscreen') {
                void fullscreen.toggle()
                return
              }
              if (item.id === 'focus') {
                focus.toggle()
                return
              }
              if (isPhoenixWorkspace(item.id)) onNavigateWorkspace(item.id)
            }}
          />
        }
      />
      <DesktopWorkspace
        activeDesktop={activeDesktop}
        controls={controls}
        controlsContextItems={controlsContextItems}
        controlsCurrentContext={controlsCurrentContext}
        copilot={copilot}
        copilotContextItems={copilotContextItems}
        copilotCurrentContext={copilotCurrentContext}
        information={information}
        informationContextItems={informationContextItems}
        informationContextLabel={informationContextLabel || undefined}
        informationCurrentContext={informationCurrentContext}
        informationRoute={informationRoute}
        journal={journal}
        developer={developer}
        showDeveloper={showDeveloper}
        developerContextItems={developerContextItems}
        developerCurrentContext={developerCurrentContext}
        journalContextItems={journalContextItems}
        journalCurrentContext={journalCurrentContext}
        onControlsContextAction={onControlsContextAction}
        onNavigateRoute={onNavigateRoute}
        onNavigateWorkspace={onNavigateWorkspace}
        settings={settings}
        settingsContextItems={settingsContextItems}
        settingsCurrentContext={settingsCurrentContext}
        telemetry={telemetry}
      />
    </ApplicationShell>
  )
}
