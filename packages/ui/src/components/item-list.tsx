import type { HTMLAttributes, LiHTMLAttributes, ReactNode } from 'react'

type ItemListProps = HTMLAttributes<HTMLUListElement> & {
  density?: 'dense' | 'compact' | 'standard' | 'comfortable'
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
  const rowClassName = [
    'item-list-row',
    leading && 'has-leading',
    eyebrow && 'has-eyebrow'
  ].filter(Boolean).join(' ')

  const content = (
    <>
      {leading && <figure className="item-list-leading">{leading}</figure>}
      {eyebrow && <small className="item-list-eyebrow">{eyebrow}</small>}
      <strong className="item-list-title">{title}</strong>
      {trailing && <div className="item-list-trailing">{trailing}</div>}
      {description && <p className="item-list-description">{description}</p>}
      {meta && <small className="item-list-meta">{meta}</small>}
    </>
  )

  return (
    <li
      className={[selected && 'active', disabled && 'disabled', actions && 'has-actions', className].filter(Boolean).join(' ')}
      {...props}
    >
      {href && !disabled ? (
        <a className={rowClassName} href={href} aria-current={selected ? 'page' : undefined}>
          {content}
        </a>
      ) : (
        <div className={rowClassName} aria-disabled={disabled || undefined}>{content}</div>
      )}
      {actions && <footer>{actions}</footer>}
    </li>
  )
}
