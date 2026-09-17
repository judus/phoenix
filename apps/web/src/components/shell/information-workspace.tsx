import type { ReactNode } from 'react'
import { Navigation, PrimaryBar } from '@phoenix/ui'
import type { ApplicationNavigationItem, NavigationItem } from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { isRouteNavigationItem, type RouteNavigationItem } from './navigation-model.js'
import { WorkspacePage } from './workspace-page.js'

export function InformationWorkspace({
  children,
  contextLabel,
  contextItems,
  currentContext,
  currentPrimary,
  onNavigate,
  primaryItems,
  swipeZone = false
}: {
  children?: ReactNode
  contextLabel: string
  contextItems: NavigationItem[]
  currentContext: string
  currentPrimary: string
  onNavigate: (route: PhoenixRoute) => void
  primaryItems: RouteNavigationItem[]
  swipeZone?: boolean
}) {
  return (
    <div className="deskplane-section" {...(swipeZone ? { 'data-deskplane-swipe-zone': 'horizontal' } : {})}>
      <PrimaryBar>
        <Navigation
          label="Primary"
          current={currentPrimary}
          items={primaryItems}
          onItemSelect={(item: ApplicationNavigationItem) => {
            if (isRouteNavigationItem(item)) onNavigate(item.route)
          }}
        />
      </PrimaryBar>
      <WorkspacePage
        contextItems={contextItems}
        contextLabel={contextLabel}
        currentContext={currentContext}
        onNavigate={onNavigate}
      >
        {children}
      </WorkspacePage>
    </div>
  )
}
