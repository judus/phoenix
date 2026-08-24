import type { CSSProperties } from 'react'
import { TileButton } from '@phoenix/ui'

export interface NumpadGridNode {
  available: boolean
  bindingLabel?: string
  columnSpan?: number
  hasChildren?: boolean
  id: string
  interactionHint?: string
  label: string
  position?: number
  rowSpan?: number
  selector: string
}

export function NumpadGrid({ columns, nodes, onSelect, pendingDigits, rows, showBackgroundNumbers = false, variableFontSizes = false }: {
  columns?: number
  nodes: readonly NumpadGridNode[]
  onSelect(id: string): void
  pendingDigits: string
  rows?: number
  showBackgroundNumbers?: boolean
  variableFontSizes?: boolean
}) {
  const columnCount = columns ?? balancedNumpadColumns(nodes.length)
  const rowCount = rows ?? Math.max(1, Math.ceil(nodes.length / columnCount))
  const gridStyle = { '--numpad-columns': columnCount, '--numpad-rows': rowCount } as CSSProperties

  return <div className="control-deck-numpad-layout"><div
    aria-label="Numpy choices"
    className={`numpad-grid${showBackgroundNumbers ? ' show-background-numbers' : ''}`}
    style={gridStyle}
  >
    {nodes.length === 0 && <p className="macro-empty">No buttons configured for this level.</p>}
    {nodes.map(node => <TileButton
      className={[!node.available ? 'disabled' : '', pendingDigits && node.selector.startsWith(pendingDigits) ? 'matching' : ''].filter(Boolean).join(' ')}
      data-selector={node.selector}
      disabled={!node.available}
      headerCorner={node.selector}
      key={node.id}
      label={node.label}
      meta={node.bindingLabel ? compactBindingLabel(node.bindingLabel) : undefined}
      metaTitle={node.bindingLabel}
      note={node.interactionHint ?? (node.hasChildren ? 'open' : undefined)}
      numbered
      onClick={() => onSelect(node.id)}
      style={node.position && columns
        ? {
            gridColumn: `${((node.position - 1) % columns) + 1} / span ${node.columnSpan ?? 1}`,
            gridRow: `${Math.floor((node.position - 1) / columns) + 1} / span ${node.rowSpan ?? 1}`
          }
        : undefined}
      variableFontSizes={variableFontSizes}
      watermarked={showBackgroundNumbers}
    />)}
  </div></div>
}

export function balancedNumpadColumns(count: number): number {
  return count <= 3 ? Math.max(1, count) : Math.min(10, Math.ceil(Math.sqrt(count)))
}

function compactBindingLabel(binding: string): string {
  const modifiers: Record<string, string> = {
    leftalt: 'LA',
    leftcontrol: 'LC',
    leftmeta: 'LM',
    leftshift: 'LS',
    rightalt: 'RA',
    rightcontrol: 'RC',
    rightmeta: 'RM',
    rightshift: 'RS'
  }
  return binding.split('+').map(part => {
    const token = part.trim()
    return modifiers[token.toLowerCase()] ?? token.replace(/^Numpad_/iu, 'NP')
  }).join('+')
}
