import type { ButtonHTMLAttributes } from 'react'

import './command-tile.css'

type CommandTileProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  binding?: string
  kind?: 'action' | 'macro'
  label: string
  meta?: string
  selected?: boolean
  tone?: 'normal' | 'danger'
  unavailable?: boolean
}

export function CommandTile({
  binding,
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
      <span>{kind === 'macro' ? 'Macro' : (binding ?? 'Unbound')}</span>
      <small>{kind === 'macro' ? meta : 'Tap'}</small>
    </button>
  )
}
