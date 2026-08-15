import type { HTMLAttributes, ReactNode } from 'react'

import './data-display.css'

export type StatusTone = 'neutral' | 'information' | 'positive' | 'warning' | 'danger' | 'muted'

type StatusProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  tone?: StatusTone
}

export function Status({ children, className, tone = 'neutral', ...props }: StatusProps) {
  return (
    <span
      className={['status', className].filter(Boolean).join(' ')}
      data-tone={tone}
      {...props}
    >
      <span className="status__marker" aria-hidden="true" />
      <span>{children}</span>
    </span>
  )
}
