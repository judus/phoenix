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
  ...props
}: CommandTileProps) {
  return (
    <button
      className="command-tile"
      data-kind={kind}
      data-selected={selected || undefined}
      data-tone={tone}
      data-unavailable={unavailable || undefined}
      disabled={unavailable}
      {...props}
    >
      <span className="command-tile__label">{label}</span>
      <span className="command-tile__binding">{kind === 'macro' ? 'Macro' : (binding ?? 'Unbound')}</span>
      <span className="command-tile__meta">{kind === 'macro' ? meta : 'Tap'}</span>
    </button>
  )
}
