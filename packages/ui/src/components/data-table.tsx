import { useMemo, useState, type HTMLAttributes, type Key, type ReactNode, type TableHTMLAttributes } from 'react'

export type DataTableProps = Omit<TableHTMLAttributes<HTMLTableElement>, 'aria-label'> & {
  density?: 'compact' | 'standard' | 'comfortable'
  label: string
  minimum?: 'standard' | 'wide'
  narrow?: 'scroll' | 'priority'
  scheme?: 'default' | 'surface' | 'information'
  stickyHeader?: boolean
  children: ReactNode
}

export type SortableDataTableValue = number | string | null | undefined

export interface SortableDataTableColumn<T> {
  cell(row: T): ReactNode
  className?: string
  heading: ReactNode
  id: string
  rowHeader?: boolean
  sortValue?(row: T): SortableDataTableValue
}

type SortDirection = 'ascending' | 'descending'

type SortableDataTableProps<T> = Omit<DataTableProps, 'children'> & {
  columns: readonly SortableDataTableColumn<T>[]
  empty?: ReactNode
  rowKey(row: T, originalIndex: number): Key
  rowProps?(row: T): HTMLAttributes<HTMLTableRowElement>
  rows: readonly T[]
}

const TABLE_COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function SortableDataTable<T>({ columns, empty = 'No records.', rowKey, rowProps, rows, ...props }: SortableDataTableProps<T>) {
  const [sort, setSort] = useState<{ columnId: string, direction: SortDirection } | null>(null)
  const orderedRows = useMemo(() => {
    const entries = rows.map((row, originalIndex) => ({ originalIndex, row }))
    if (!sort) return entries
    const column = columns.find(candidate => candidate.id === sort.columnId)
    if (!column?.sortValue) return entries
    const sortValue = column.sortValue
    return entries.sort((left, right) => (
      compareTableValues(sortValue(left.row), sortValue(right.row), sort.direction) ||
      left.originalIndex - right.originalIndex
    ))
  }, [columns, rows, sort])
  const changeSort = (columnId: string) => setSort(current => {
    if (!current || current.columnId !== columnId) return { columnId, direction: 'ascending' }
    if (current.direction === 'ascending') return { columnId, direction: 'descending' }
    return null
  })

  return (
    <DataTable {...props}>
      <thead><tr>{columns.map(column => {
        const activeDirection = sort?.columnId === column.id ? sort.direction : undefined
        if (!column.sortValue) return <th className={column.className} key={column.id}>{column.heading}</th>
        return <th
          aria-sort={activeDirection}
          className={['sortable', column.className].filter(Boolean).join(' ')}
          key={column.id}
        ><button type="button" onClick={() => changeSort(column.id)}><span className="sort-heading">{column.heading}</span><span aria-hidden="true" className="sort-indicator" /></button></th>
      })}</tr></thead>
      <tbody>{orderedRows.length === 0
        ? <tr><td colSpan={columns.length}>{empty}</td></tr>
        : orderedRows.map(({ originalIndex, row }) => {
            const attributes = rowProps?.(row)
            return <tr {...attributes} key={rowKey(row, originalIndex)}>{columns.map(column => {
              const Cell = column.rowHeader ? 'th' : 'td'
              return <Cell className={column.className} key={column.id} {...(column.rowHeader ? { scope: 'row' as const } : {})}>{column.cell(row)}</Cell>
            })}</tr>
          })}</tbody>
    </DataTable>
  )
}

function compareTableValues(left: SortableDataTableValue, right: SortableDataTableValue, direction: SortDirection): number {
  const leftMissing = left === null || left === undefined
  const rightMissing = right === null || right === undefined
  if (leftMissing || rightMissing) return leftMissing === rightMissing ? 0 : leftMissing ? 1 : -1
  const compared = typeof left === 'number' && typeof right === 'number'
    ? left - right
    : TABLE_COLLATOR.compare(String(left), String(right))
  return direction === 'ascending' ? compared : -compared
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
  contentGap?: 'none' | 'sm'
  fill?: boolean
  meta?: ReactNode
  title: string
  tone?: 'default' | 'muted'
}

export function DataTableGroup({ children, className, contentGap = 'none', fill = false, meta, title, tone = 'default', ...props }: DataTableGroupProps) {
  return (
    <section
      className={['data-table-group', contentGap !== 'none' && `content-gap-${contentGap}`, fill && 'fill', tone === 'muted' && 'muted', className].filter(Boolean).join(' ')}
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
