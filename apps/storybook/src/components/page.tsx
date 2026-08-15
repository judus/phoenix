import { useId, type HTMLAttributes, type ReactNode } from 'react'

import { ControlContext } from './control-context'
import './page.css'

export function PageFrame({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <main
      className={['page-frame', className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}

type PageHeaderProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode
  context?: string
  description?: ReactNode
  metadata?: ReactNode
  title: string
  variant?: 'standard' | 'entity' | 'compact'
}

export function PageHeader({
  actions,
  className,
  context,
  description,
  metadata,
  title,
  variant = 'standard',
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={['page-header', className].filter(Boolean).join(' ')}
      data-variant={variant}
      {...props}
    >
      <div className="page-header__content">
        {context && <span className="page-header__context">{context}</span>}
        <h1 className="page-header__title">{title}</h1>
        {description && <div className="page-header__description">{description}</div>}
        {metadata && <div className="page-header__metadata">{metadata}</div>}
      </div>
      {actions && (
        <ControlContext className="page-header__actions" context="toolbar" density="compact">
          {actions}
        </ControlContext>
      )}
    </header>
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
      className={['section', className].filter(Boolean).join(' ')}
      data-divider={divider || undefined}
      aria-labelledby={headingId}
      {...props}
    >
      <div className="section__header">
        <div className="section__heading">
          <h2 className="section__title" id={headingId}>{title}</h2>
          {description && <div className="section__description">{description}</div>}
        </div>
        {actions && (
          <ControlContext className="section__actions" context="toolbar" density="compact">
            {actions}
          </ControlContext>
        )}
      </div>
      <div className="section__content">{children}</div>
    </section>
  )
}

type PanelProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode
  description?: ReactNode
  title?: string
  variant?: 'standard' | 'quiet' | 'danger'
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
      className={['panel', className].filter(Boolean).join(' ')}
      data-variant={variant}
      aria-labelledby={headingId}
      {...props}
    >
      {(title || description || actions) && (
        <div className="panel__header">
          <div className="panel__heading">
            {title && <h3 className="panel__title" id={headingId}>{title}</h3>}
            {description && <div className="panel__description">{description}</div>}
          </div>
          {actions && <div className="panel__actions">{actions}</div>}
        </div>
      )}
      <div className="panel__content">{children}</div>
    </article>
  )
}
