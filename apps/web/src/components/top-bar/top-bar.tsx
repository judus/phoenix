import type { ReactNode } from 'react'

export interface TopBarProps {
  actions?: ReactNode
  brand: ReactNode
  utilityActions?: ReactNode
}

export function TopBar ({ actions, brand, utilityActions }: TopBarProps) {
  return (
    <div className="top-bar-frame">
      {utilityActions && <div className="top-bar__utility-actions">{utilityActions}</div>}
      <div className="top-bar">
        <div className="top-bar__brand">{brand}</div>
        {actions && <div className="top-bar__actions">{actions}</div>}
      </div>
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
      <span className="app-brand__mark" aria-hidden="true" />
      <span className="app-brand__label">
        <strong>{name}</strong>
        {qualifier && <small>{qualifier}</small>}
      </span>
    </div>
  )
}
