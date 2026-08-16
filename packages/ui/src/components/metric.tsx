import type { HTMLAttributes, ReactNode } from 'react'

type MetricProps = HTMLAttributes<HTMLDivElement> & {
  density?: 'standard' | 'compact'
  detail?: ReactNode
  label?: ReactNode
  value: ReactNode
}

export function Metric({ className, density = 'standard', detail, label, value, ...props }: MetricProps) {
  return (
    <div className={['metric', density === 'compact' && 'compact', className].filter(Boolean).join(' ')} {...props}>
      {label && <span>{label}</span>}
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  )
}
