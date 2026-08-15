import type { HTMLAttributes } from 'react'

import './data-display.css'

type MeterProps = HTMLAttributes<HTMLDivElement> & {
  label: string
  max?: number
  tone?: 'action' | 'information' | 'warning' | 'danger'
  value: number
  valueLabel: string
}

export function Meter({ className, label, max = 100, tone = 'information', value, valueLabel, ...props }: MeterProps) {
  return (
    <div className={['meter', `meter-${tone}`, className].filter(Boolean).join(' ')} {...props}>
      <header>
        <span>{label}</span>
        <span>{valueLabel}</span>
      </header>
      <progress aria-label={label} max={max} value={value} />
    </div>
  )
}
