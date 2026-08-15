import type { ComponentPropsWithoutRef } from 'react'

export type ControlContextName = 'panel' | 'toolbar' | 'command'
export type ControlDensity = 'compact' | 'regular' | 'comfortable'

type ControlContextProps = ComponentPropsWithoutRef<'div'> & {
  context?: ControlContextName
  density?: ControlDensity
}

export function ControlContext({
  context = 'panel',
  density = 'regular',
  ...props
}: ControlContextProps) {
  return <div data-control-context={context} data-density={density} {...props} />
}
