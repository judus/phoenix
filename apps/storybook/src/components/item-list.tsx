import type { HTMLAttributes, LiHTMLAttributes, ReactNode } from 'react'

import './data-display.css'

type ItemListProps = HTMLAttributes<HTMLUListElement> & {
  density?: 'compact' | 'standard' | 'comfortable'
}

export function ItemList({ density = 'standard', className, ...props }: ItemListProps) {
  return (
    <ul
      className={['item-list', className].filter(Boolean).join(' ')}
      data-density={density}
      {...props}
    />
  )
}

type ItemListItemProps = LiHTMLAttributes<HTMLLIElement> & {
  actions?: ReactNode
  description?: ReactNode
  disabled?: boolean
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
      {leading && <div className="item-list__leading">{leading}</div>}
      <div className="item-list__body">
        <div className="item-list__primary">
          <strong className="item-list__title">{title}</strong>
          {trailing && <div className="item-list__trailing">{trailing}</div>}
        </div>
        {description && <div className="item-list__description">{description}</div>}
        {meta && <div className="item-list__meta">{meta}</div>}
      </div>
    </>
  )

  return (
    <li
      className={['item-list__item', className].filter(Boolean).join(' ')}
      data-disabled={disabled || undefined}
      data-selected={selected || undefined}
      {...props}
    >
      {href && !disabled ? (
        <a className="item-list__link" href={href} aria-current={selected ? 'page' : undefined}>
          {content}
        </a>
      ) : (
        <div className="item-list__content" aria-disabled={disabled || undefined}>{content}</div>
      )}
      {actions && <div className="item-list__actions">{actions}</div>}
    </li>
  )
}
