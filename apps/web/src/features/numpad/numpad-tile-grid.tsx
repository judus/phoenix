import type { NumpadTreeNode } from '@phoenix/contracts'
import { NumpadGrid } from '@jdu/control-deck-ui'

export function NumpadTileGrid({ columns, nodes, onSelect, pendingDigits, rows, variableFontSizes }: { columns?: number, nodes: NumpadTreeNode[], onSelect(id: string): void, pendingDigits: string, rows?: number, variableFontSizes: boolean }) {
  return <NumpadGrid
    columns={columns}
    nodes={nodes.map(node => ({
      available: node.available,
      bindingLabel: node.bindingLabel ?? undefined,
      columnSpan: node.span,
      hasChildren: node.kind === 'menu' || node.kind === 'navigation',
      id: node.id,
      interactionHint: node.interactionHint,
      label: node.label,
      position: node.position,
      selector: node.selector
    }))}
    pendingDigits={pendingDigits}
    rows={rows}
    showBackgroundNumbers
    variableFontSizes={variableFontSizes}
    onSelect={onSelect}
  />
}
