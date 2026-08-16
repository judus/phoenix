import type { HTMLAttributes, LiHTMLAttributes, ReactNode } from 'react'

import './data-display.css'

type ItemListProps = HTMLAttributes<HTMLUListElement> & {
  density?: 'compact' | 'standard' | 'comfortable'
}

export function ItemList({ density = 'standard', className, ...props }: ItemListProps) {
  return (
    <ul
      className={[
        'item-list',
        density !== 'standard' && density,
        className
      ].filter(Boolean).join(' ')}
      {...props}
    />
  )
}

type ItemListItemProps = LiHTMLAttributes<HTMLLIElement> & {
  actions?: ReactNode
  description?: ReactNode
  disabled?: boolean
  eyebrow?: ReactNode
  href?: string
  leading?: ReactNode
  meta?: ReactNode
  selected?: boolean
  title: ReactNode
  trailing?: ReactNode
}

export function ItemListItem({
  actions,
  className,
  description,
  disabled = false,
  eyebrow,
  href,
  leading,
  meta,
  selected = false,
  title,
  trailing,
  ...props
}: ItemListItemProps) {
  const content = (
    <>
      {leading && <figure>{leading}</figure>}
      <article>
        {eyebrow && <small>{eyebrow}</small>}
        <header>
          <strong>{title}</strong>
          {trailing && <span>{trailing}</span>}
        </header>
        {description && <p>{description}</p>}
        {meta && <small>{meta}</small>}
      </article>
    </>
  )

  return (
    <li
      className={[selected && 'active', disabled && 'disabled', className].filter(Boolean).join(' ')}
      {...props}
    >
      {href && !disabled ? (
        <a href={href} aria-current={selected ? 'page' : undefined}>
          {content}
        </a>
      ) : (
        <div aria-disabled={disabled || undefined}>{content}</div>
      )}
      {actions && <footer>{actions}</footer>}
    </li>
  )
}
