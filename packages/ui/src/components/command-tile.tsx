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
  return (
    <button
      className={[
        'command-tile',
        !details && 'label-only',
        kind === 'macro' && 'command-macro',
        selected && 'active',
        tone === 'danger' && 'command-danger',
        unavailable && 'unavailable',
        className
      ].filter(Boolean).join(' ')}
      aria-pressed={selected || undefined}
      disabled={unavailable}
      {...props}
    >
      <strong>{label}</strong>
      {details && (
        <>
          <span>{kind === 'macro' ? 'Macro' : (binding ?? 'Unbound')}</span>
          <small>{kind === 'macro' ? meta : 'Tap'}</small>
        </>
      )}
    </button>
  )
}
