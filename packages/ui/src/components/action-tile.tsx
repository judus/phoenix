import type { ButtonHTMLAttributes, ReactNode } from 'react'

import './control-surface.css'
import './action-tile.css'

type ActionTileProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  description?: ReactNode
  eyebrow?: ReactNode
  label: ReactNode
  status?: ReactNode
}

export function ActionTile({ className, description, eyebrow, label, status, ...props }: ActionTileProps) {
  return (
    <button className={['action-tile', className].filter(Boolean).join(' ')} type="button" {...props}>
      {eyebrow && <small>{eyebrow}</small>}
      <strong>{label}</strong>
      {description && <p>{description}</p>}
      {status && <span>{status}</span>}
    </button>
  )
}
