import { NumpadGrid, balancedColumnCount } from '@phoenix/control-deck/react'
import type { NumpadTreeNode } from '@phoenix/contracts'
import { ActionTile } from '@phoenix/ui'

export { balancedColumnCount }

export function NumpadTileGrid ({ columns, nodes, onSelect, pendingDigits, rows }: { columns?: number, nodes: NumpadTreeNode[], onSelect(id: string): void, pendingDigits: string, rows?: number }) {
  return <NumpadGrid
    columns={columns}
    empty={<p className="text-muted">No commands configured for this branch.</p>}
    nodes={nodes}
    rows={rows}
    renderNode={(node, placement) => <ActionTile
      className={pendingDigits && node.selector.startsWith(pendingDigits) ? 'matching' : undefined}
      data-selector={node.selector}
      description={node.description}
      disabled={!node.available}
      eyebrow={node.selector}
      label={node.label}
      onClick={() => onSelect(node.id)}
      status={node.kind === 'menu' ? 'Open ›' : 'command'}
      style={placement}
    />}
  />
}
