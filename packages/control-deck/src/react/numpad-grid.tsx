import { Fragment, type CSSProperties, type ReactNode } from 'react'
import type { NumpadTreeNode } from '../core/index.js'

export function NumpadGrid ({
  className = 'numpad-grid',
  columns,
  empty,
  nodes,
  renderNode,
  rows
}: {
  className?: string
  columns?: number
  empty?: ReactNode
  nodes: NumpadTreeNode[]
  renderNode(node: NumpadTreeNode, placement: CSSProperties | undefined): ReactNode
  rows?: number
}) {
  const count = columns ?? balancedColumnCount(nodes.length)
  const style = { '--numpad-columns': count, '--numpad-rows': rows ?? Math.max(1, Math.ceil(nodes.length / count)) } as CSSProperties
  return <div aria-label="Numpad command choices" className={className} style={style}>
    {nodes.length === 0 && empty}
    {nodes.map(node => <Fragment key={node.id}>{renderNode(node, placement(node, columns))}</Fragment>)}
  </div>
}

export function balancedColumnCount (count: number): number {
  return count <= 3 ? Math.max(1, count) : Math.min(10, Math.ceil(Math.sqrt(count * 1.6)))
}

function placement (node: NumpadTreeNode, columns: number | undefined): CSSProperties | undefined {
  return node.position && columns
    ? { gridColumn: `${((node.position - 1) % columns) + 1} / span ${node.span ?? 1}`, gridRow: Math.floor((node.position - 1) / columns) + 1 }
    : undefined
}
