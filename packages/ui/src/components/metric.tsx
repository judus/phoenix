import type { HTMLAttributes, ReactNode } from 'react'

type MetricProps = HTMLAttributes<HTMLDivElement> & {
  density?: 'standard' | 'compact'
  detail?: ReactNode
  label?: ReactNode
  labelTone?: 'standard' | 'action'
  value: ReactNode
}

export function Metric({ className, density = 'standard', detail, label, labelTone = 'standard', value, ...props }: MetricProps) {
  return (
    <div className={['metric', density === 'compact' && 'compact', labelTone === 'action' && 'label-action', className].filter(Boolean).join(' ')} {...props}>
      {label && <span>{label}</span>}
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  )
}

type MetricStripProps = HTMLAttributes<HTMLDListElement> & {
  columns: 2 | 3 | 4 | 5 | 6
}

export function MetricStrip({ children, className, columns, ...props }: MetricStripProps) {
  return (
    <dl className={['metric-strip', `columns-${columns}`, className].filter(Boolean).join(' ')} {...props}>
      {children}
    </dl>
  )
}

type MetricStripItemProps = HTMLAttributes<HTMLDivElement> & {
  detail?: ReactNode
  label: ReactNode
  value: ReactNode
}

export function MetricStripItem({ detail, label, value, ...props }: MetricStripItemProps) {
  return (
    <div {...props}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      {detail && <small>{detail}</small>}
    </div>
  )
}
