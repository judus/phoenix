import type { HTMLAttributes, ReactNode } from 'react'

import type { ApplicationNavigationItem } from './app-shell'
import './application-shell.css'

type NavigationProps = HTMLAttributes<HTMLElement> & {
  current?: string
  items: ApplicationNavigationItem[]
  label: string
  onItemSelect?: (item: ApplicationNavigationItem) => void
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
      className={[
        'application-navigation',
        `navigation-${variant}`,
        `selection-${selection}`,
        className
      ].filter(Boolean).join(' ')}
      aria-label={label}
      {...props}
    >
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.disabled ? (
              <span className="nav-item disabled" aria-disabled="true">
                <abbr title={item.label} aria-hidden="true">
                  {item.shortLabel ?? item.label.slice(0, 3)}
                </abbr>
                <span>{item.label}</span>
                {item.badge && <small>{item.badge}</small>}
              </span>
            ) : item.kind === 'action' ? (
              <button
                type="button"
                className={['nav-item', item.pressed && 'active'].filter(Boolean).join(' ')}
                aria-label={item.label}
                aria-pressed={item.pressed}
                onClick={() => onItemSelect?.(item)}
                title={variant === 'compact' ? item.label : undefined}
              >
                <abbr title={item.label} aria-hidden="true">
                  {item.shortLabel ?? item.label.slice(0, 3)}
                </abbr>
                <span>{item.label}</span>
                {item.badge && <small>{item.badge}</small>}
              </button>
            ) : (
              <a
                className={['nav-item', current === item.id && 'active'].filter(Boolean).join(' ')}
                href={item.href}
                aria-current={current === item.id ? 'page' : undefined}
                onClick={(event) => {
                  if (!onItemSelect) return
                  event.preventDefault()
                  onItemSelect(item)
                }}
                title={variant === 'compact' ? item.label : undefined}
              >
                <abbr title={item.label} aria-hidden="true">
                  {item.shortLabel ?? item.label.slice(0, 3)}
                </abbr>
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
    <header className={['topbar', className].filter(Boolean).join(' ')} {...props}>
      <div className="brand">{brand}</div>
      {status && <div className="status-area">{status}</div>}
      {utilities && <div className="utilities">{utilities}</div>}
    </header>
  )
}

type PrimaryBarProps = HTMLAttributes<HTMLDivElement> & {
  launcher?: ReactNode
}

export function PrimaryBar({ children, className, launcher, ...props }: PrimaryBarProps) {
  return (
    <div
      className={['primary-bar', launcher && 'has-launcher', className].filter(Boolean).join(' ')}
      {...props}
    >
      {launcher && <div className="launcher">{launcher}</div>}
      <div className="primary-navigation">{children}</div>
    </div>
  )
}

export function Workspace({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={['shell-body', className].filter(Boolean).join(' ')} {...props} />
}

type RailProps = HTMLAttributes<HTMLElement> & {
  label: string
}

export function Rail({ className, label, ...props }: RailProps) {
  return (
    <aside
      className={['context-rail', className].filter(Boolean).join(' ')}
      aria-label={label}
      {...props}
    />
  )
}

export function Content({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['workspace', className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}

export function BottomBar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={['workspace-navigation', className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}
