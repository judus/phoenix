import type { HTMLAttributes, ReactNode } from 'react'

import './app-shell.css'

export type NavigationItem = {
  badge?: ReactNode
  disabled?: boolean
  href: string
  id: string
  label: string
  shortLabel?: string
}

type AppNavigationProps = HTMLAttributes<HTMLElement> & {
  current: string
  items: NavigationItem[]
  label: string
  slot?: 'primary' | 'secondary'
}

export function AppNavigation({
  className,
  current,
  items,
  label,
  slot = 'primary',
  ...props
}: AppNavigationProps) {
  return (
    <nav
      className={['app-navigation', className].filter(Boolean).join(' ')}
      data-slot={slot}
      aria-label={label}
      {...props}
    >
      <ul className="app-navigation__list">
        {items.map((item) => (
          <li key={item.id} className="app-navigation__entry">
            {item.disabled ? (
              <span className="app-navigation__item" aria-disabled="true" data-disabled="true">
                {item.shortLabel && <span className="app-navigation__short" aria-hidden="true">{item.shortLabel}</span>}
                <span className="app-navigation__label">{item.label}</span>
                {item.badge && <span className="app-navigation__badge">{item.badge}</span>}
              </span>
            ) : (
              <a
                className={['app-navigation__item', current === item.id && 'active'].filter(Boolean).join(' ')}
                href={item.href}
                aria-current={current === item.id ? 'page' : undefined}
              >
                {item.shortLabel && <span className="app-navigation__short" aria-hidden="true">{item.shortLabel}</span>}
                <span className="app-navigation__label">{item.label}</span>
                {item.badge && <span className="app-navigation__badge">{item.badge}</span>}
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}

type AppShellProps = HTMLAttributes<HTMLDivElement> & {
  brand: ReactNode
  children: ReactNode
  navigation?: 'sidebar' | 'bands'
  primaryNavigation: ReactNode
  secondaryNavigation?: ReactNode
  status?: ReactNode
  utilities?: ReactNode
}

export function AppShell({
  brand,
  children,
  className,
  navigation = 'sidebar',
  primaryNavigation,
  secondaryNavigation,
  status,
  utilities,
  ...props
}: AppShellProps) {
  return (
    <div
      className={['app-shell-container', className].filter(Boolean).join(' ')}
      {...props}
    >
      <div className="app-shell" data-navigation={navigation}>
        <header className="app-shell__header">
          <div className="app-shell__brand">{brand}</div>
          {status && <div className="app-shell__status">{status}</div>}
          {utilities && <div className="app-shell__utilities">{utilities}</div>}
        </header>
        <div className="app-shell__primary">{primaryNavigation}</div>
        <div className="app-shell__workspace" data-scroll-owner="workspace">
          {children}
        </div>
        {secondaryNavigation && <div className="app-shell__secondary">{secondaryNavigation}</div>}
      </div>
    </div>
  )
}
