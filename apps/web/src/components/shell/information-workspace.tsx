import type { ReactNode } from 'react'
import { Navigation, PrimaryBar } from '@phoenix/ui'
import type { ApplicationNavigationItem, NavigationItem } from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { homeItem, isRouteNavigationItem, type RouteNavigationItem } from './navigation-model.js'
import { WorkspacePage } from './workspace-page.js'

export function InformationWorkspace({
  children,
  contextLabel,
  contextItems,
  currentContext,
  currentPrimary,
  onNavigate,
  primaryItems
}: {
  children?: ReactNode
  contextLabel: string
  contextItems: NavigationItem[]
  currentContext: string
  currentPrimary: string
  onNavigate: (route: PhoenixRoute) => void
  primaryItems: RouteNavigationItem[]
}) {
  return (
    <div className="deskplane-section">
      <PrimaryBar launcher={(
        <a
          className={currentPrimary === 'home' ? 'active' : undefined}
          href={homeItem.href}
          aria-label="Home"
          aria-current={currentPrimary === 'home' ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault()
            onNavigate(homeItem.route)
          }}
        >⌂</a>
      )}>
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
