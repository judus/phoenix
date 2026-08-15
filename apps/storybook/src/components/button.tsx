import type { ButtonHTMLAttributes } from 'react'

import './controls.css'
import './control-surface.css'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger'
export type ButtonSize = 'inherit' | 'sm' | 'md' | 'lg'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  busy?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'inherit',
  busy = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={[
        'btn',
        `btn-${variant}`,
        size !== 'inherit' && `btn-${size}`,
        className
      ].filter(Boolean).join(' ')}
      aria-busy={busy || undefined}
      disabled={disabled || busy}
      {...props}
    >
      {busy ? 'Working…' : children}
    </button>
  )
}

type IconButtonProps = ButtonProps & {
  label: string
  shape?: 'square' | 'landscape'
}

export function IconButton({ children, className, label, shape = 'square', title, ...props }: IconButtonProps) {
  return (
    <Button
      className={['btn-icon', `btn-icon-${shape}`, className].filter(Boolean).join(' ')}
      aria-label={label}
      title={title ?? label}
      {...props}
    >
      {children}
    </Button>
  )
}
