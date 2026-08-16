import type { ReactNode } from 'react'
import { Content, Navigation, Rail } from '@phoenix/ui'
import type { NavigationItem } from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { isRouteNavigationItem } from './navigation-model.js'

export function WorkspacePage({
  children,
  currentContext,
  contextItems,
  contextLabel,
  onNavigate
}: {
  children?: ReactNode
  currentContext: string
  contextItems: NavigationItem[]
  contextLabel: string
  onNavigate?: (route: PhoenixRoute) => void
}) {
  return (
    <div className="deskplane-page">
      <Rail label={contextLabel}>
        <Navigation
          variant="compact"
          selection="subtle"
          label={contextLabel}
          current={currentContext}
          items={contextItems}
          onItemSelect={onNavigate ? (item) => {
            if (isRouteNavigationItem(item)) onNavigate(item.route)
          } : undefined}
        />
      </Rail>
      <Content>{children}</Content>
    </div>
  )
}

export function UtilityWorkspacePage({ children }: { children: ReactNode }) {
  return (
    <div className="deskplane-page">
      <Content>{children}</Content>
    </div>
  )
}
