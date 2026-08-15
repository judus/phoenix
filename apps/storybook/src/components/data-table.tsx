import type { ReactNode, TableHTMLAttributes } from 'react'

import './data-display.css'

type DataTableProps = Omit<TableHTMLAttributes<HTMLTableElement>, 'aria-label'> & {
  density?: 'compact' | 'standard' | 'comfortable'
  label: string
  minimum?: 'standard' | 'wide'
  narrow?: 'scroll' | 'priority'
  children: ReactNode
}

export function DataTable({
  children,
  className,
  density = 'standard',
  label,
  minimum = 'standard',
  narrow = 'scroll',
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
