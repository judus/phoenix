import type { ComponentPropsWithoutRef } from 'react'

export type ControlContextName = 'panel' | 'toolbar' | 'command'
export type ControlDensity = 'compact' | 'regular' | 'comfortable'

type ControlContextProps = ComponentPropsWithoutRef<'div'> & {
  context?: ControlContextName
  density?: ControlDensity
}

export function ControlContext({
  className,
  context = 'panel',
  density = 'regular',
  ...props
}: ControlContextProps) {
  return (
    <div
      className={['controls', `controls-${context}`, `density-${density}`, className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}
