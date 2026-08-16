import type { ReactNode } from 'react'
import { Navigation, PrimaryBar } from '@phoenix/ui'
import type { NavigationItem } from '@phoenix/ui'
import { WorkspacePage } from './workspace-page.js'

export function InformationWorkspace({
  children,
  contextItems,
  currentContext,
  currentPrimary,
  onHome,
  primaryItems
}: {
  children?: ReactNode
  contextItems: NavigationItem[]
  currentContext: string
  currentPrimary: string
  onHome?: () => void
  primaryItems: NavigationItem[]
}) {
  return (
    <div className="deskplane-section">
      <PrimaryBar launcher={(
        <a
          href="#home"
          aria-label="Home"
          onClick={onHome ? (event) => {
            event.preventDefault()
            onHome()
          } : undefined}
        >⌂</a>
      )}>
        <Navigation label="Primary" current={currentPrimary} items={primaryItems} />
      </PrimaryBar>
      <WorkspacePage
        contextItems={contextItems}
        contextLabel="Commander views"
        currentContext={currentContext}
      >
        {children}
      </WorkspacePage>
    </div>
  )
}
