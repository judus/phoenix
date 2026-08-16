import type { ReactNode } from 'react'
import { Content, Navigation, Rail } from '@phoenix/ui'
import type { NavigationItem } from '@phoenix/ui'

export function WorkspacePage({
  children,
  currentContext,
  contextItems,
  contextLabel
}: {
  children?: ReactNode
  currentContext: string
  contextItems: NavigationItem[]
  contextLabel: string
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
