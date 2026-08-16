import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'outline' | 'action' | 'quiet' | 'danger'
export type ButtonSize = 'inherit' | 'sm' | 'md' | 'lg'
export type ButtonAlignment = 'center' | 'start'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  alignment?: ButtonAlignment
  variant?: ButtonVariant
  size?: ButtonSize
  busy?: boolean
}

export function Button({
  alignment = 'center',
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
        alignment === 'start' && 'btn-start',
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
