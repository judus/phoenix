import type { ButtonHTMLAttributes } from 'react'

type CommandTileProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  binding?: string
  details?: boolean
  kind?: 'action' | 'macro'
  label: string
  meta?: string
  selected?: boolean
  tone?: 'normal' | 'danger'
  unavailable?: boolean
}

export function CommandTile({
  binding,
  details = true,
  kind = 'action',
  label,
  meta = 'Tap',
  selected = false,
  tone = 'normal',
  unavailable = false,
  className,
  ...props
}: CommandTileProps) {
  const bindingLabel = kind === 'macro' ? 'Macro' : (binding ?? 'Unbound')
  const displayedBinding = bindingLabel
    .replaceAll('Numpad_', 'NP_')
    .replaceAll('LeftShift', 'LS')
    .replaceAll('RightShift', 'RS')

  return (
    <button
      className={[
        'command-tile',
        !details && 'label-only',
        kind === 'macro' && 'command-macro',
        selected && 'active',
        tone === 'danger' && 'command-danger',
        unavailable && 'disabled',
        className
      ].filter(Boolean).join(' ')}
      aria-label={binding ? `${label}, ${binding}` : undefined}
      aria-pressed={selected || undefined}
      disabled={unavailable}
      {...props}
    >
      <strong>{label}</strong>
      {details && (
        <>
          <span title={bindingLabel}>{displayedBinding}</span>
          <small>{meta}</small>
        </>
      )}
    </button>
  )
}
