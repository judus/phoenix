import type { HTMLAttributes, ReactNode } from 'react'

import './data-display.css'

type DescriptionListProps = HTMLAttributes<HTMLDListElement> & {
  columns?: 'auto' | 'one' | 'two'
  density?: 'standard' | 'compact'
  inset?: boolean
}

export function DescriptionList({
  className,
  columns = 'auto',
  density = 'standard',
  inset = false,
  ...props
}: DescriptionListProps) {
  return (
    <dl
      className={[
        'dl-list',
        columns === 'one' && 'one-column',
        columns === 'two' && 'two-columns',
        density === 'compact' && 'compact',
        inset && 'inset',
        className
      ].filter(Boolean).join(' ')}
      {...props}
    />
  )
}

type DescriptionItemProps = HTMLAttributes<HTMLDivElement> & {
  label: ReactNode
  value: ReactNode
}

export function DescriptionItem({ className, label, value, ...props }: DescriptionItemProps) {
  return (
    <div className={className} {...props}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
