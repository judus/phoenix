import type { ReactNode } from 'react'
import { IconButton } from './button'

/** Shows the destination view, rather than a switch with both view icons. */
export function ViewToggle({ startLabel, startIcon, endLabel, endIcon, position, onPositionChange }: {
  startLabel: string
  startIcon: ReactNode
  endLabel: string
  endIcon: ReactNode
  position: 'start' | 'end'
  onPositionChange(position: 'start' | 'end'): void
}) {
  const next = position === 'start' ? 'end' : 'start'
  const label = `Show ${(next === 'start' ? startLabel : endLabel).toLocaleLowerCase()} view`
  return <IconButton label={label} variant="outline" onClick={() => onPositionChange(next)}>
    {next === 'start' ? startIcon : endIcon}
  </IconButton>
}
