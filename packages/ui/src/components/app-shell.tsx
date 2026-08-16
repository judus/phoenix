import type { HTMLAttributes, ReactNode } from 'react'

type NavigationItemBase = {
  badge?: ReactNode
  disabled?: boolean
  id: string
  label: string
  shortLabel?: string
}

export type NavigationItem = NavigationItemBase & { href: string, kind?: 'link' }
export type NavigationActionItem = NavigationItemBase & { kind: 'action', pressed?: boolean }
export type ApplicationNavigationItem = NavigationItem | NavigationActionItem

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
      className={['app-navigation', `navigation-${slot}`, className].filter(Boolean).join(' ')}
      aria-label={label}
      {...props}
    >
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.disabled ? (
              <span className="nav-item disabled" aria-disabled="true">
                {item.shortLabel && <abbr title={item.label} aria-hidden="true">{item.shortLabel}</abbr>}
                <span>{item.label}</span>
                {item.badge && <small>{item.badge}</small>}
              </span>
            ) : (
              <a
                className={['nav-item', current === item.id && 'active'].filter(Boolean).join(' ')}
                href={item.href}
                aria-current={current === item.id ? 'page' : undefined}
              >
                {item.shortLabel && <abbr title={item.label} aria-hidden="true">{item.shortLabel}</abbr>}
                <span>{item.label}</span>
                {item.badge && <small>{item.badge}</small>}
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
      <div className={['app-shell', `navigation-${navigation}`].join(' ')}>
        <header className="topbar">
          <div className="brand">{brand}</div>
          {status && <div className="status-area">{status}</div>}
          {utilities && <div className="utilities">{utilities}</div>}
        </header>
        <div className="primary-navigation">{primaryNavigation}</div>
        <div className="workspace">
          {children}
        </div>
        {secondaryNavigation && <div className="secondary-navigation">{secondaryNavigation}</div>}
      </div>
    </div>
  )
}
