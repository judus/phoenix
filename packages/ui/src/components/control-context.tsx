import type { ComponentPropsWithoutRef } from 'react'

export type ControlContextName = 'panel' | 'toolbar' | 'command'
export type ControlDensity = 'compact' | 'regular' | 'comfortable'
export type ControlVariant = 'standard' | 'embedded'

type ControlContextProps = ComponentPropsWithoutRef<'div'> & {
  context?: ControlContextName
  density?: ControlDensity
  variant?: ControlVariant
}

export function ControlContext({
  className,
  context = 'panel',
  density,
  variant = 'standard',
  ...props
}: ControlContextProps) {
  return (
    <div
      className={[
        'controls',
        `controls-${context}`,
        density && `density-${density}`,
        variant !== 'standard' && `controls-${variant}`,
        className
      ].filter(Boolean).join(' ')}
      {...props}
    />
  )
}
