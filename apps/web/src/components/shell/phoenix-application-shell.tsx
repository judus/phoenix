import type { ReactNode } from 'react'
import { ApplicationShell, BottomBar, Navigation, TopBar } from '@phoenix/ui'
import type { ApplicationNavigationItem, NavigationItem } from '@phoenix/ui'
import { DesktopWorkspace } from './desktop-workspace.js'
import { PhoenixBrand } from './phoenix-brand.js'
import { isRouteNavigationItem, utilityItems, workspaceItems } from './navigation-model.js'
import { useFullscreen } from '../../platform/fullscreen/use-fullscreen.js'
import type { InformationRoute, PhoenixRoute, PhoenixWorkspace } from '../../application/navigation/phoenix-route.js'

export interface PhoenixApplicationShellProps {
  activeDesktop: PhoenixWorkspace
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

  return (
    <ApplicationShell>
      <TopBar
        brand={<PhoenixBrand />}
        utilities={
          <Navigation
            variant="compact"
            label="Utilities"
            current={activeDesktop}
            items={utilityItems(fullscreen)}
            onItemSelect={(item) => {
              if (item.id === 'fullscreen') {
                void fullscreen.toggle()
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
        {...(controlsContextItems ? { controlsContextItems } : {})}
        {...(controlsCurrentContext ? { controlsCurrentContext } : {})}
        copilot={copilot}
        {...(copilotContextItems ? { copilotContextItems } : {})}
        {...(copilotCurrentContext ? { copilotCurrentContext } : {})}
        information={information}
        {...(informationContextItems ? { informationContextItems } : {})}
        {...(informationContextLabel ? { informationContextLabel } : {})}
        {...(informationCurrentContext ? { informationCurrentContext } : {})}
        informationRoute={informationRoute}
        journal={journal}
        {...(journalContextItems ? { journalContextItems } : {})}
        {...(journalCurrentContext ? { journalCurrentContext } : {})}
        macros={macros}
        onControlsContextAction={onControlsContextAction}
        onNavigateRoute={onNavigateRoute}
        onNavigateWorkspace={onNavigateWorkspace}
        settings={settings}
        {...(settingsContextItems ? { settingsContextItems } : {})}
        {...(settingsCurrentContext ? { settingsCurrentContext } : {})}
        telemetry={telemetry}
      />
      <BottomBar>
        <Navigation
          className="workspace-switcher"
          variant="compact"
          selection="subtle"
          label="Workspaces"
          current={activeDesktop}
          items={workspaceItems(informationRoute)}
          onItemSelect={(item) => {
            if (isRouteNavigationItem(item)) onNavigateRoute(item.route)
          }}
        />
      </BottomBar>
    </ApplicationShell>
  )
}
