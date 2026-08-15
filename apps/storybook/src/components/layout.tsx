import type { HTMLAttributes, ReactNode } from 'react'

import './layout.css'

type Space = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'

type StackProps = HTMLAttributes<HTMLDivElement> & {
  gap?: Space
  align?: 'stretch' | 'start' | 'center' | 'end'
}

export function Stack({ gap = 'md', align = 'stretch', className, ...props }: StackProps) {
  return (
    <div
      className={['stack', `gap-${gap}`, `align-${align}`, className].filter(Boolean).join(' ')}
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
  minimum?: 'sm' | 'md' | 'lg'
}
export function AutoGrid({ gap = 'sm', minimum = 'md', className, ...props }: AutoGridProps) {
  return (
    <div
      className={['auto-grid', `grid-${minimum}`, `gap-${gap}`, className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}
