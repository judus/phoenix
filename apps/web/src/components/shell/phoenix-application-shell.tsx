import type { ReactNode } from 'react'
import { ApplicationShell, BottomBar, Navigation, TopBar } from '@phoenix/ui'
import { DesktopWorkspace } from './desktop-workspace.js'
import { PhoenixBrand } from './phoenix-brand.js'
import { isRouteNavigationItem, utilityItems, workspaceItems } from './navigation-model.js'
import { useFullscreen } from '../../platform/fullscreen/use-fullscreen.js'
import type { InformationRoute, PhoenixRoute, PhoenixWorkspace } from '../../platform/routing/phoenix-route.js'

export interface PhoenixApplicationShellProps {
  activeDesktop: PhoenixWorkspace
  controls: ReactNode
  copilot: ReactNode
  developer: ReactNode
  information: ReactNode
  journal: ReactNode
  macros: ReactNode
  informationRoute: InformationRoute
  onNavigateRoute: (route: PhoenixRoute) => void
  onNavigateWorkspace: (desktop: PhoenixWorkspace) => void
  settings: ReactNode
  telemetry: ReactNode
}

export function PhoenixApplicationShell({
  activeDesktop,
  controls,
  copilot,
  developer,
  information,
  informationRoute,
  journal,
  macros,
  onNavigateRoute,
  onNavigateWorkspace,
  settings,
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
        copilot={copilot}
        developer={developer}
        information={information}
        informationRoute={informationRoute}
        journal={journal}
        macros={macros}
        onNavigateRoute={onNavigateRoute}
        onNavigateWorkspace={onNavigateWorkspace}
        settings={settings}
        telemetry={telemetry}
      />
      <BottomBar>
        <Navigation
          variant="workspace"
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
