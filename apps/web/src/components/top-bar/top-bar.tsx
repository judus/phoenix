import type { ReactNode } from 'react'

export interface TopBarProps {
  actions?: ReactNode
  brand: ReactNode
}

export function TopBar ({ actions, brand }: TopBarProps) {
  return (
    <div className="top-bar">
      <div className="top-bar__brand">{brand}</div>
      {actions && <div className="top-bar__actions">{actions}</div>}
    </div>
  )
}

export interface AppBrandProps {
  name: string
  qualifier?: string
}

export function AppBrand ({ name, qualifier }: AppBrandProps) {
  return (
    <div className="app-brand">
      <span className="app-brand__mark" aria-hidden="true">P</span>
      <span className="app-brand__label">
        <strong>{name}</strong>
        {qualifier && <small>{qualifier}</small>}
      </span>
    </div>
  )
}
