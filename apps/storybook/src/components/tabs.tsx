import type { HTMLAttributes } from 'react'

import './tabs.css'

export type TabItem = {
  disabled?: boolean
  href: string
  id: string
  label: string
}

type TabsProps = HTMLAttributes<HTMLElement> & {
  current: string
  items: TabItem[]
  label: string
}

export function Tabs({ className, current, items, label, ...props }: TabsProps) {
  return (
    <nav className={['tabs', className].filter(Boolean).join(' ')} aria-label={label} {...props}>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.disabled ? (
              <span className="disabled" aria-disabled="true">{item.label}</span>
            ) : (
              <a
                className={current === item.id ? 'active' : undefined}
                href={item.href}
                aria-current={current === item.id ? 'page' : undefined}
              >
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
