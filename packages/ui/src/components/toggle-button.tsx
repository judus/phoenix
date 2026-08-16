import type { ButtonHTMLAttributes } from 'react'

type ToggleButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-pressed'> & {
  pressed: boolean
  tone?: 'information' | 'warning'
}

export function ToggleButton({ children, className, pressed, tone = 'information', ...props }: ToggleButtonProps) {
  return (
    <button
      className={[
        'btn',
        'btn-toggle',
        `text-${tone}`,
        pressed && 'active',
        className
      ].filter(Boolean).join(' ')}
      aria-pressed={pressed}
      type="button"
      {...props}
    >
      {children}
    </button>
  )
}
