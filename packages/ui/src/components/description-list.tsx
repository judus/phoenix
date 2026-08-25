import type { HTMLAttributes, ReactNode } from 'react'

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
  labelTone?: 'standard' | 'action'
  value: ReactNode
}

export function DescriptionItem({ className, label, labelTone = 'standard', value, ...props }: DescriptionItemProps) {
  return (
    <div className={[labelTone === 'action' && 'label-action', className].filter(Boolean).join(' ')} {...props}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
