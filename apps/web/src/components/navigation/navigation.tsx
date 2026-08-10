import type { ReactNode } from 'react'

export interface NavigationItem {
  disabled?: boolean
  href?: string
  icon?: ReactNode
  id: string
  label: string
  onActivate?: () => void
}

export interface NavigationProps {
  activeItemId?: string
  items: NavigationItem[]
}

export function PrimaryNavigation ({ activeItemId, items }: NavigationProps) {
  return (
    <nav className="primary-navigation" aria-label="Primary navigation">
      <ul className="primary-navigation__list">
        {items.map(item => (
          <li key={item.id} className="primary-navigation__item">
            <a
              className="primary-navigation__link"
              href={item.href ?? '#'}
              aria-current={item.id === activeItemId ? 'page' : undefined}
              aria-disabled={item.disabled || undefined}
              tabIndex={item.disabled ? -1 : undefined}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function SecondaryNavigation ({ activeItemId, items }: NavigationProps) {
  return (
    <nav className="secondary-navigation" aria-label="Section navigation">
      <ul className="secondary-navigation__list">
        {items.map(item => {
          const content = (
            <>
              <span className="secondary-navigation__icon" aria-hidden="true">{item.icon}</span>
              <span className="visually-hidden">{item.label}</span>
            </>
          )
          return (
            <li key={item.id} className="secondary-navigation__item">
              {item.onActivate
                ? (
                    <button
                      type="button"
                      className="secondary-navigation__link"
                      aria-current={item.id === activeItemId ? 'page' : undefined}
                      disabled={item.disabled}
                      onClick={item.onActivate}
                      title={item.label}
                    >
                      {content}
                    </button>
                  )
                : (
                    <a
                      className="secondary-navigation__link"
                      href={item.href ?? '#'}
                      aria-current={item.id === activeItemId ? 'page' : undefined}
                      aria-disabled={item.disabled || undefined}
                      tabIndex={item.disabled ? -1 : undefined}
                      title={item.label}
                    >
                      {content}
                    </a>
                  )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
