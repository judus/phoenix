import type { ReactNode } from 'react'

export interface PageProps {
  children: ReactNode
  className?: string
}

export function Page ({ children, className }: PageProps) {
  const classes = ['page', className].filter(Boolean).join(' ')
  return <main className={classes}>{children}</main>
}

export interface PageHeaderProps {
  actions?: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  title: ReactNode
}

export function PageHeader ({ actions, description, eyebrow, title }: PageHeaderProps) {
  return (
    <header className="page-header">
      <h1 className="page-header__title">{title}</h1>
      {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
      {description && <div className="page-header__description">{description}</div>}
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}

export interface PageContentProps {
  children: ReactNode
  variant?: 'inset' | 'bleed'
}

export function PageContent ({ children, variant = 'inset' }: PageContentProps) {
  return <div className={`page-content page-content--${variant}`}>{children}</div>
}
