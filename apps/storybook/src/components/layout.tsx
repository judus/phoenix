import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'

import './layout.css'

type Space = 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'

function layoutStyle(properties: Record<string, string>): CSSProperties {
  return properties as CSSProperties
}

type StackProps = HTMLAttributes<HTMLDivElement> & {
  gap?: Space
  align?: 'stretch' | 'start' | 'center' | 'end'
}

export function Stack({ gap = 'md', align = 'stretch', className, style, ...props }: StackProps) {
  return (
    <div
      className={['stack', className].filter(Boolean).join(' ')}
      style={{ ...layoutStyle({ '--layout-gap': `var(--spacing-${gap})`, '--stack-align': align }), ...style }}
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
  style,
  ...props
}: InlineProps) {
  return (
    <div
      className={['inline', className].filter(Boolean).join(' ')}
      data-wrap={wrap}
      style={{
        ...layoutStyle({
          '--layout-gap': `var(--spacing-${gap})`,
          '--inline-align': align,
          '--inline-justify': justify
        }),
        ...style
      }}
      {...props}
    />
  )
}

type AutoGridProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  gap?: Space
  minimum?: 'sm' | 'md' | 'lg' | string
}

const gridMinimums = {
  sm: '10rem',
  md: '14rem',
  lg: '18rem'
}

export function AutoGrid({ gap = 'sm', minimum = 'md', className, style, ...props }: AutoGridProps) {
  const resolvedMinimum = minimum in gridMinimums
    ? gridMinimums[minimum as keyof typeof gridMinimums]
    : minimum

  return (
    <div
      className={['auto-grid', className].filter(Boolean).join(' ')}
      style={{
        ...layoutStyle({ '--layout-gap': `var(--spacing-${gap})`, '--grid-minimum': resolvedMinimum }),
        ...style
      }}
      {...props}
    />
  )
}
