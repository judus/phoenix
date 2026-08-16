import type { HTMLAttributes, ReactNode, TableHTMLAttributes } from 'react'

type DataTableProps = Omit<TableHTMLAttributes<HTMLTableElement>, 'aria-label'> & {
  density?: 'compact' | 'standard' | 'comfortable'
  label: string
  minimum?: 'standard' | 'wide'
  narrow?: 'scroll' | 'priority'
  scheme?: 'default' | 'surface' | 'information'
  stickyHeader?: boolean
  children: ReactNode
}

export function DataTable({
  children,
  className,
  density = 'standard',
  label,
  minimum = 'standard',
  narrow = 'scroll',
  scheme = 'default',
  stickyHeader = false,
  ...props
}: DataTableProps) {
  return (
    <div
      className={[
        'table-region',
        `table-${narrow}`,
        minimum === 'wide' && 'table-wide'
      ].filter(Boolean).join(' ')}
      role={narrow === 'scroll' ? 'region' : undefined}
      aria-label={narrow === 'scroll' ? `${label}, horizontally scrollable` : undefined}
      tabIndex={narrow === 'scroll' ? 0 : undefined}
    >
      <table
        className={[
          'data-table',
          density !== 'standard' && density,
          scheme !== 'default' && scheme,
          stickyHeader && 'sticky-header',
          className
        ].filter(Boolean).join(' ')}
        {...props}
      >
        <caption>{label}</caption>
        {children}
      </table>
    </div>
  )
}

type DataTableGroupProps = HTMLAttributes<HTMLElement> & {
  meta?: ReactNode
  title: string
  tone?: 'default' | 'muted'
}

export function DataTableGroup({ children, className, meta, title, tone = 'default', ...props }: DataTableGroupProps) {
  return (
    <section
      className={['data-table-group', tone === 'muted' && 'muted', className].filter(Boolean).join(' ')}
      {...props}
    >
      <header>
        <h2>{title}</h2>
        {meta !== undefined && meta !== null && <span>{meta}</span>}
      </header>
      {children}
    </section>
  )
}
