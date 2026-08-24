import type { ButtonHTMLAttributes } from 'react'
import { TileButton } from './tile'

type CommandTileProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  binding?: string
  compact?: boolean
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
  compact = false,
  details = true,
  kind = 'action',
  label,
  meta = 'Tap',
  selected = false,
  tone = 'normal',
  unavailable = false,
  disabled = unavailable,
  className,
  ...props
}: CommandTileProps) {
  const bindingLabel = kind === 'macro' ? 'Macro' : (binding ?? 'Unbound')
  const displayedBinding = bindingLabel
    .replaceAll('Numpad_', 'NP_')
    .replaceAll('LeftShift', 'LS')
    .replaceAll('RightShift', 'RS')

  return (
    <TileButton
      className={[
        compact && 'compact',
        !details && 'label-only',
        kind === 'macro' && 'theme-macro',
        selected && 'active',
        tone === 'danger' && 'theme-danger',
        unavailable && 'unavailable',
        className
      ].filter(Boolean).join(' ')}
      aria-label={binding ? `${label}, ${binding}` : undefined}
      aria-pressed={selected || undefined}
      disabled={disabled}
      label={label}
      meta={details ? displayedBinding : undefined}
      metaTitle={details ? bindingLabel : undefined}
      note={details ? meta : undefined}
      {...props}
    />
  )
}
