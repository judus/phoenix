import type { ReactNode } from 'react'
import { ApplicationShell, BottomBar, Navigation, TopBar } from '@phoenix/ui'
import type { ApplicationNavigationItem, NavigationItem } from '@phoenix/ui'
import { DesktopWorkspace } from './desktop-workspace.js'
import { PhoenixBrand } from './phoenix-brand.js'
import { isRouteNavigationItem, utilityItems, workspaceItems } from './navigation-model.js'
import { useWorkspaceFocus } from './use-workspace-focus.js'
import { useFullscreen } from '../../platform/fullscreen/use-fullscreen.js'
import { isPhoenixWorkspace, type InformationRoute, type PhoenixRoute, type PhoenixWorkspace } from '../../application/navigation/phoenix-route.js'

export interface PhoenixApplicationShellProps {
  activeDesktop: PhoenixWorkspace
  controlsDestination?: PhoenixRoute
  copilotDestination?: PhoenixRoute
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
  developerContextItems?: NavigationItem[]
  developerCurrentContext?: string
  journalContextItems?: NavigationItem[]
  journalCurrentContext?: string
  macros: ReactNode
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
  developerContextItems,
  developerCurrentContext,
  journalContextItems,
  journalCurrentContext,
  macros,
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
            label="Utilities"
            current={activeDesktop}
            items={utilityItems(fullscreen, focus.active, androidShell)}
            onItemSelect={(item) => {
              if (item.id === 'fullscreen') {
                void fullscreen.toggle()
                return
              }
              if (item.id === 'focus') {
                focus.toggle()
                return
              }
              if (isRouteNavigationItem(item)) onNavigateRoute(item.route)
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
        developerContextItems={developerContextItems}
        developerCurrentContext={developerCurrentContext}
        journalContextItems={journalContextItems}
        journalCurrentContext={journalCurrentContext}
        macros={macros}
        onControlsContextAction={onControlsContextAction}
        onNavigateRoute={onNavigateRoute}
        onNavigateWorkspace={onNavigateWorkspace}
        settings={settings}
        settingsContextItems={settingsContextItems}
        settingsCurrentContext={settingsCurrentContext}
        telemetry={telemetry}
      />
      <BottomBar>
        <Navigation
          className="workspace-switcher"
          variant="compact"
          selection="subtle"
          label="Workspaces"
          current={activeDesktop}
          items={workspaceItems(informationRoute, controlsDestination, copilotDestination)}
          onItemSelect={(item) => {
            if (isPhoenixWorkspace(item.id)) onNavigateWorkspace(item.id)
          }}
        />
      </BottomBar>
    </ApplicationShell>
  )
}
