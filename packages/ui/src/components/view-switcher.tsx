import type { ButtonHTMLAttributes, ReactNode } from 'react'

import { Button } from './button'
type ViewPosition = 'start' | 'end'

type ViewSwitcherProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  endIcon: ReactNode
  endLabel: string
  onPositionChange: (position: ViewPosition) => void
  position: ViewPosition
  startIcon: ReactNode
  startLabel: string
}

export function ViewSwitcher({
  className,
  endIcon,
  endLabel,
  onPositionChange,
  position,
  startIcon,
  startLabel,
  title,
  ...props
}: ViewSwitcherProps) {
  const nextPosition = position === 'start' ? 'end' : 'start'
  const currentLabel = position === 'start' ? startLabel : endLabel
  const nextLabel = nextPosition === 'start' ? startLabel : endLabel

  return (
    <Button
      className={['view-switcher', className].filter(Boolean).join(' ')}
      variant="quiet"
      role="switch"
      aria-checked={position === 'end'}
      aria-label={`${currentLabel} view`}
      data-position={position}
      title={title ?? `Switch to ${nextLabel.toLocaleLowerCase()} view`}
      onClick={() => onPositionChange(nextPosition)}
      {...props}
    >
      {startIcon}
      <span className="track" aria-hidden="true"><span /></span>
      {endIcon}
    </Button>
  )
}
