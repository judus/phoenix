import type { ReactNode } from 'react'

export interface AppShellProps {
  children: ReactNode
  header: ReactNode
  secondaryNavigation?: ReactNode
}

export function AppShell ({ children, header, secondaryNavigation }: AppShellProps) {
  return (
    <div className="app-shell">
      {header}
      <div className="app-workspace">
        {secondaryNavigation}
        {children}
      </div>
    </div>
  )
}

export interface AppHeaderProps {
  navigation: ReactNode
  topBar: ReactNode
}

export function AppHeader ({ navigation, topBar }: AppHeaderProps) {
  return (
    <header className="app-header">
      {topBar}
      {navigation}
    </header>
  )
}

