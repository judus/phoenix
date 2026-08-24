import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { TileButton } from './tile'

type ActionTileProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  description?: ReactNode
  label: ReactNode
  status?: ReactNode
}

export function ActionTile({ className, description, label, status, ...props }: ActionTileProps) {
  return (
    <TileButton
      body={description && <p>{description}</p>}
      className={className}
      label={label}
      meta={status}
      type="button"
      {...props}
    />
  )
}
