import type { CSSProperties } from 'react'
import type { NumpadTreeNode } from '@phoenix/contracts'
import { ActionTile } from '@phoenix/ui'

export function NumpadTileGrid({ columns, nodes, onSelect, pendingDigits, rows }: { columns?: number, nodes: NumpadTreeNode[], onSelect(id: string): void, pendingDigits: string, rows?: number }) {
  const count = columns ?? balancedColumnCount(nodes.length)
  const style = { '--numpad-columns': count, '--numpad-rows': rows ?? Math.max(1, Math.ceil(nodes.length / count)) } as CSSProperties
  return <div aria-label="Numpad command choices" className="numpad-grid" style={style}>
    {nodes.length === 0 && <p className="text-muted">No commands configured for this branch.</p>}
    {nodes.map(node => <ActionTile
      className={pendingDigits && node.selector.startsWith(pendingDigits) ? 'matching' : undefined}
      data-selector={node.selector}
      description={node.description}
      disabled={!node.available}
      eyebrow={node.selector}
      key={node.id}
      label={node.label}
      onClick={() => onSelect(node.id)}
      status={node.kind === 'menu' ? 'Open ›' : node.kind.replace('-', ' ')}
      style={node.position && columns ? { gridColumn: `${((node.position - 1) % columns) + 1} / span ${node.span ?? 1}`, gridRow: Math.floor((node.position - 1) / columns) + 1 } : undefined}
    />)}
  </div>
}

export function balancedColumnCount(count: number): number { return count <= 3 ? Math.max(1, count) : Math.min(10, Math.ceil(Math.sqrt(count * 1.6))) }
