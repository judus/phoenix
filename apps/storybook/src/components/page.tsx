import { useId, type HTMLAttributes, type ReactNode } from 'react'

import { ControlContext } from './control-context'
import './page.css'

type PageFrameProps = HTMLAttributes<HTMLElement> & {
  layout?: 'flow' | 'fit'
}

export function PageFrame({ className, layout = 'flow', ...props }: PageFrameProps) {
  return (
    <main
      className={['page-frame', `page-${layout}`, className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}

type PageHeaderProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode
  context?: ReactNode
  description?: ReactNode
  metadata?: ReactNode
  navigation?: ReactNode
  title: string
  variant?: 'standard' | 'entity' | 'compact' | 'cockpit'
}

export function PageHeader({
  actions,
  className,
  context,
  description,
  metadata,
  navigation,
  title,
  variant = 'standard',
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={['page-header', `page-header-${variant}`, className].filter(Boolean).join(' ')}
      {...props}
    >
      <div>
        {context && <div>{context}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {metadata && <small>{metadata}</small>}
      </div>
      {actions && (
        <ControlContext className="actions" context="toolbar" density="compact">
          {actions}
        </ControlContext>
      )}
      {navigation && <div className="navigation">{navigation}</div>}
    </header>
  )
}

type BreadcrumbItem = {
  href?: string
  label: string
}

type BreadcrumbsProps = HTMLAttributes<HTMLElement> & {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ className, items, ...props }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={['breadcrumbs', className].filter(Boolean).join(' ')} {...props}>
      <ol>
        {items.map((item, index) => (
          <li key={item.label}>
            {item.href
              ? <a href={item.href}>{item.label}</a>
              : <span aria-current={index === items.length - 1 ? 'page' : undefined}>{item.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}

type SectionProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode
  description?: ReactNode
  divider?: boolean
  title: string
}

export function Section({
  actions,
  children,
  className,
  description,
  divider = false,
  title,
  ...props
}: SectionProps) {
  const generatedId = useId()
  const headingId = props['aria-labelledby'] ?? generatedId

  return (
    <section
      className={['section', divider && 'divided', className].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
      {...props}
    >
      <header>
        <div>
          <h2 id={headingId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions && (
          <ControlContext className="actions" context="toolbar" density="compact">
            {actions}
          </ControlContext>
        )}
      </header>
      <div>{children}</div>
    </section>
  )
}

type PanelProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode
  description?: ReactNode
  title?: string
  variant?: 'standard' | 'quiet' | 'cockpit' | 'danger'
}

export function Panel({
  actions,
  children,
  className,
  description,
  title,
  variant = 'standard',
  ...props
}: PanelProps) {
  const generatedId = useId()
  const headingId = title ? (props['aria-labelledby'] ?? generatedId) : undefined

  return (
    <article
      className={['panel', `panel-${variant}`, className].filter(Boolean).join(' ')}
      aria-labelledby={headingId}
      {...props}
    >
      {(title || description || actions) && (
        <header>
          <div>
            {title && <h3 id={headingId}>{title}</h3>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="actions">{actions}</div>}
        </header>
      )}
      <div>{children}</div>
    </article>
  )
}
