import type { HTMLAttributes, ReactNode } from 'react'

export type StatusTone = 'neutral' | 'information' | 'positive' | 'warning' | 'danger' | 'muted'

type StatusProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  tone?: StatusTone
  wrap?: boolean
}

export function Status({ children, className, tone = 'neutral', wrap = false, ...props }: StatusProps) {
  return (
    <span
      className={['status', `status-${tone}`, wrap && 'status-wrap', className].filter(Boolean).join(' ')}
      {...props}
    >
      <span>{children}</span>
    </span>
  )
}
