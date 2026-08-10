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
  description?: ReactNode
  eyebrow?: ReactNode
  title: ReactNode
}

export function PageHeader ({ description, eyebrow, title }: PageHeaderProps) {
  return (
    <header className="page-header">
      <h1 className="page-header__title">{title}</h1>
      {eyebrow && <p className="page-header__eyebrow">{eyebrow}</p>}
      {description && <div className="page-header__description">{description}</div>}
    </header>
  )
}

export function PageContent ({ children }: { children: ReactNode }) {
  return <div className="page-content">{children}</div>
}

export function PageFooter ({ children }: { children: ReactNode }) {
  return <footer className="page-footer">{children}</footer>
}

