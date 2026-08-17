import type { HTMLAttributes, ReactNode } from 'react'

export type StatusTone = 'neutral' | 'information' | 'positive' | 'warning' | 'danger' | 'muted'

type StatusProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  marker?: boolean
  tone?: StatusTone
  wrap?: boolean
}

export function Status({ children, className, marker = true, tone = 'neutral', wrap = false, ...props }: StatusProps) {
  return (
    <span
      className={['status', `status-${tone}`, wrap && 'status-wrap', className].filter(Boolean).join(' ')}
      {...props}
    >
      {marker && <i aria-hidden="true" />}
      <span>{children}</span>
    </span>
  )
}
