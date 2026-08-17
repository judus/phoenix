import type { HTMLAttributes } from 'react'

type MeterProps = HTMLAttributes<HTMLDivElement> & {
  label: string
  layout?: 'stacked' | 'inline' | 'compact'
  max?: number
  tone?: 'action' | 'information' | 'warning' | 'danger'
  value: number
  valueLabel: string
}

export function Meter({ className, label, layout = 'stacked', max = 100, tone = 'information', value, valueLabel, ...props }: MeterProps) {
  return (
    <div className={['meter', `meter-${tone}`, layout !== 'stacked' && `meter-${layout}`, className].filter(Boolean).join(' ')} {...props}>
      <span>{label}</span>
      <progress aria-label={label} max={max} value={value} />
      <output>{valueLabel}</output>
    </div>
  )
}
