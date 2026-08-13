import type { CSSProperties } from 'react'
import type { NumpadTreeNode } from '@phoenix/contracts'

interface NumpadTileGridProps {
  columns?: number
  nodes: NumpadTreeNode[]
  pendingDigits: string
  onSelect: (nodeId: string) => void
}

type GridStyle = CSSProperties & { '--numpad-columns': number }

export function NumpadTileGrid ({ columns, nodes, onSelect, pendingDigits }: NumpadTileGridProps) {
  const count = columns ?? Math.max(1, Math.min(nodes.length, 10))
  const style: GridStyle = { '--numpad-columns': count }

  return (
    <div className="numpad-grid" style={style} aria-label="Numpad command choices">
      {nodes.map(node => {
        const matching = pendingDigits !== '' && node.selector.startsWith(pendingDigits)
        const exact = pendingDigits !== '' && node.selector === pendingDigits
        const tileStyle = node.position && columns
          ? {
              gridColumn: `${((node.position - 1) % columns) + 1} / span ${node.span ?? 1}`,
              gridRow: Math.floor((node.position - 1) / columns) + 1
            }
          : undefined
        return (
          <button
            key={node.id}
            type="button"
            className="numpad-tile"
            data-exact={exact || undefined}
            data-matching={matching || undefined}
            data-kind={node.kind}
            disabled={!node.available}
            style={tileStyle}
            onClick={() => onSelect(node.id)}
          >
            <span className="numpad-tile__selector">{node.selector}</span>
            <span className="numpad-tile__label">{node.label}</span>
            <span className="numpad-tile__meta">
              {node.kind === 'menu' ? 'OPEN' : node.kind.replace('-', ' ')}
              {node.kind === 'menu' && <span aria-hidden="true"> ›</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
