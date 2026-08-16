import type { HTMLAttributes, ReactNode } from 'react'

import './layout.css'

type Space = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'

type StackProps = HTMLAttributes<HTMLDivElement> & {
  gap?: Space
  align?: 'stretch' | 'start' | 'center' | 'end'
  fill?: boolean
  justify?: 'start' | 'center' | 'end' | 'space-between'
}

export function Stack({ gap = 'md', align = 'stretch', className, fill = false, justify = 'start', ...props }: StackProps) {
  return (
    <div
      className={[
        'stack',
        `gap-${gap}`,
        `align-${align}`,
        `justify-${justify}`,
        fill && 'fill',
        className
      ].filter(Boolean).join(' ')}
      {...props}
    />
  )
}

type InlineProps = HTMLAttributes<HTMLDivElement> & {
  gap?: Space
  align?: 'stretch' | 'start' | 'center' | 'end' | 'baseline'
  justify?: 'start' | 'center' | 'end' | 'space-between'
  wrap?: boolean
}

export function Inline({
  gap = 'sm',
  align = 'center',
  justify = 'start',
  wrap = true,
  className,
  ...props
}: InlineProps) {
  return (
    <div
      className={[
        'inline',
        `gap-${gap}`,
        `align-${align}`,
        `justify-${justify}`,
        wrap ? 'wrap' : 'nowrap',
        className
      ].filter(Boolean).join(' ')}
      {...props}
    />
  )
}

type AutoGridProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  gap?: Space
  minimum?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}
export function AutoGrid({ gap = 'sm', minimum = 'md', className, ...props }: AutoGridProps) {
  return (
    <div
      className={['auto-grid', `grid-${minimum}`, `gap-${gap}`, className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}

type EqualGridProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  columns?: 2 | 3 | 4
  gap?: Space
}

export function EqualGrid({ columns = 2, gap = 'sm', className, ...props }: EqualGridProps) {
  return (
    <div
      className={['equal-grid', `columns-${columns}`, `gap-${gap}`, className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}

type ThirdsGridProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  gap?: Space
}

export function ThirdsGrid({ gap = 'sm', className, ...props }: ThirdsGridProps) {
  return (
    <div className="thirds-layout">
      <div className={['thirds-grid', `gap-${gap}`, className].filter(Boolean).join(' ')} {...props} />
    </div>
  )
}

type DashboardGridProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  gap?: Space
  lastRow: ReactNode
}

export function DashboardGrid({ children, className, gap = 'sm', lastRow, ...props }: DashboardGridProps) {
  return (
    <div className={['dashboard-grid', `gap-${gap}`, className].filter(Boolean).join(' ')} {...props}>
      <ThirdsGrid gap={gap}>{children}</ThirdsGrid>
      <ThirdsGrid gap={gap}>{lastRow}</ThirdsGrid>
    </div>
  )
}
