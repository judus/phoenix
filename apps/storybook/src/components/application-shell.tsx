import type { HTMLAttributes, ReactNode } from 'react'

import type { NavigationItem } from './app-shell'
import './application-shell.css'

type NavigationProps = HTMLAttributes<HTMLElement> & {
  current?: string
  items: NavigationItem[]
  label: string
  onItemSelect?: (item: NavigationItem) => void
  selection?: 'strong' | 'subtle'
  variant?: 'primary' | 'compact' | 'workspace'
}

export function Navigation({
  className,
  current,
  items,
  label,
  onItemSelect,
  selection = 'strong',
  variant = 'primary',
  ...props
}: NavigationProps) {
  return (
    <nav
      className={['application-navigation', className].filter(Boolean).join(' ')}
      data-selection={selection}
      data-variant={variant}
      aria-label={label}
      {...props}
    >
      <ul className="application-navigation__list">
        {items.map((item) => (
          <li key={item.id} className="application-navigation__entry">
            {item.disabled ? (
              <span className="application-navigation__item" data-disabled="true" aria-disabled="true">
                <span className="application-navigation__compact" aria-hidden="true">
                  {item.shortLabel ?? item.label.slice(0, 3)}
                </span>
                <span className="application-navigation__label">{item.label}</span>
                {item.badge && <span className="application-navigation__badge">{item.badge}</span>}
              </span>
            ) : (
              <a
                className={['application-navigation__item', current === item.id && 'active'].filter(Boolean).join(' ')}
                href={item.href}
                aria-current={current === item.id ? 'page' : undefined}
                onClick={(event) => {
                  if (!onItemSelect) return
                  event.preventDefault()
                  onItemSelect(item)
                }}
                title={variant === 'compact' ? item.label : undefined}
              >
                <span className="application-navigation__compact" aria-hidden="true">
                  {item.shortLabel ?? item.label.slice(0, 3)}
                </span>
                <span className="application-navigation__label">{item.label}</span>
                {item.badge && <span className="application-navigation__badge">{item.badge}</span>}
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function ApplicationShell({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={['application-shell-container', className].filter(Boolean).join(' ')} {...props}>
      <div className="application-shell">{children}</div>
    </div>
  )
}

type TopBarProps = HTMLAttributes<HTMLElement> & {
  brand: ReactNode
  status?: ReactNode
  utilities?: ReactNode
}

export function TopBar({ brand, className, status, utilities, ...props }: TopBarProps) {
  return (
    <header className={['application-shell__topbar', className].filter(Boolean).join(' ')} {...props}>
      <div className="application-shell__brand">{brand}</div>
      {status && <div className="application-shell__status">{status}</div>}
      {utilities && <div className="application-shell__utilities">{utilities}</div>}
    </header>
  )
}

type PrimaryBarProps = HTMLAttributes<HTMLDivElement> & {
  launcher?: ReactNode
}

export function PrimaryBar({ children, className, launcher, ...props }: PrimaryBarProps) {
  return (
    <div
      className={['application-shell__primary-band', className].filter(Boolean).join(' ')}
      data-launcher={Boolean(launcher)}
      {...props}
    >
      {launcher && <div className="application-shell__launcher">{launcher}</div>}
      <div className="application-shell__primary">{children}</div>
    </div>
  )
}

export function Workspace({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['application-shell__body', className].filter(Boolean).join(' ')} {...props} />
}

type RailProps = HTMLAttributes<HTMLElement> & {
  label: string
}

export function Rail({ className, label, ...props }: RailProps) {
  return (
    <aside
      className={['application-shell__context', className].filter(Boolean).join(' ')}
      aria-label={label}
      {...props}
    />
  )
}

export function Content({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['application-shell__workspace', className].filter(Boolean).join(' ')}
      data-scroll-owner="workspace"
      {...props}
    />
  )
}

export function BottomBar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['application-shell__workspace-navigation', className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}
