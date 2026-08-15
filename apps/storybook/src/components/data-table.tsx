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
      className="data-table-region"
      data-minimum={minimum}
      data-narrow={narrow}
      role={narrow === 'scroll' ? 'region' : undefined}
      aria-label={narrow === 'scroll' ? `${label}, horizontally scrollable` : undefined}
      tabIndex={narrow === 'scroll' ? 0 : undefined}
    >
      <table
        className={['data-table', className].filter(Boolean).join(' ')}
        data-density={density}
        data-narrow={narrow}
        {...props}
      >
        <caption className="data-table__caption">{label}</caption>
        {children}
      </table>
    </div>
  )
}
