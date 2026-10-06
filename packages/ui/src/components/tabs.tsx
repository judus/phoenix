import type { HTMLAttributes, KeyboardEvent } from 'react'

export type TabItem = {
  disabled?: boolean
  href: string
  id: string
  label: string
}

type TabsProps = Omit<HTMLAttributes<HTMLElement>, 'onSelect'> & {
  current: string
  label: string
} & ({ items: TabItem[], onSelect?: never } | {
  items: { disabled?: boolean, id: string, label: string, panelId: string }[]
  onSelect(id: string): void
})

export function Tabs({ className, current, items, label, onSelect, ...props }: TabsProps) {
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const enabled = items.filter(item => !item.disabled)
    const index = enabled.findIndex(item => item.id === id)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1
      : event.key === 'ArrowRight' ? (index + 1) % enabled.length
      : event.key === 'ArrowLeft' ? (index + enabled.length - 1) % enabled.length : undefined
    if (next === undefined) return
    event.preventDefault()
    const item = enabled[next]!
    onSelect?.(item.id)
    event.currentTarget.ownerDocument.getElementById(item.id)?.focus()
  }
  return (
    <nav className={['tabs', className].filter(Boolean).join(' ')} aria-label={label} {...props}>
      <ul role={onSelect ? 'tablist' : undefined} aria-label={onSelect ? label : undefined}>
        {items.map((item) => (
          <li key={item.id} role={onSelect ? 'presentation' : undefined}>
            {onSelect && 'panelId' in item ? (
              <button type="button" role="tab" id={item.id} aria-controls={item.panelId}
                aria-selected={current === item.id} tabIndex={current === item.id ? 0 : -1}
                className={current === item.id ? 'active' : undefined} disabled={item.disabled}
                onClick={() => onSelect(item.id)} onKeyDown={event => navigate(event, item.id)}>
                {item.label}
              </button>
            ) : item.disabled ? (
              <span className="disabled" aria-disabled="true">{item.label}</span>
            ) : (
              <a
                className={current === item.id ? 'active' : undefined}
                href={'href' in item ? item.href : undefined}
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
