import type { HTMLAttributes, ReactNode } from 'react'

export type StatusTone = 'neutral' | 'information' | 'positive' | 'warning' | 'danger' | 'muted'

type StatusProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  tone?: StatusTone
}

export function Status({ children, className, tone = 'neutral', ...props }: StatusProps) {
  return (
    <span
      className={['status', `status-${tone}`, className].filter(Boolean).join(' ')}
      {...props}
    >
      <i aria-hidden="true" />
      <span>{children}</span>
    </span>
  )
}
