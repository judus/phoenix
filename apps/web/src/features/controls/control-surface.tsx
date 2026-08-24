import type { CSSProperties, ReactNode } from 'react'
import type { ControlDeckCommandElement, ControlDeckDeck, ControlDeckSpacerElement } from 'control-deck/core'

interface EmptyCell {
  column: number
  row: number
  spacer?: ControlDeckSpacerElement
}

interface SurfaceSlot {
  column: number
  row: number
  columnSpan: number
  rowSpan: number
  element?: ControlDeckCommandElement | ControlDeckSpacerElement
}

export function ControlSurface({
  'aria-label': ariaLabel,
  className,
  deck,
  renderCommand,
  renderEmpty
}: {
  'aria-label': string
  className?: string
  deck: ControlDeckDeck
  renderCommand(element: ControlDeckCommandElement): ReactNode
  renderEmpty(cell: EmptyCell): ReactNode
}) {
  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${deck.layout.columns}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${deck.layout.rows}, minmax(0, 1fr))`
  }

  return <div
    aria-label={ariaLabel}
    className={['control-deck-surface', className].filter(Boolean).join(' ')}
    role="group"
    style={style}
  >
    {surfaceSlots(deck).map(slot => {
      const element = slot.element
      return <div
        className="control-deck-slot"
        data-element-id={element?.id}
        key={element?.id ?? `empty_${slot.column}_${slot.row}`}
        style={{
          gridColumn: `${slot.column} / span ${slot.columnSpan}`,
          gridRow: `${slot.row} / span ${slot.rowSpan}`,
          ...(element?.kind === 'command'
            ? {
                color: element.appearance.foregroundColor ?? undefined,
                backgroundColor: element.appearance.backgroundColor ?? undefined
              }
            : {})
        }}
      >
        {element?.kind === 'command'
          ? renderCommand(element)
          : renderEmpty({ column: slot.column, row: slot.row, spacer: element })}
      </div>
    })}
  </div>
}

function surfaceSlots(deck: ControlDeckDeck): SurfaceSlot[] {
  const occupied = new Set<string>()
  const slots: SurfaceSlot[] = deck.elements.map(element => {
    const placement = element.placement
    for (let row = placement.row; row < placement.row + placement.rowSpan; row++) {
      for (let column = placement.column; column < placement.column + placement.columnSpan; column++) {
        occupied.add(`${column}:${row}`)
      }
    }
    return {
      column: placement.column,
      row: placement.row,
      columnSpan: placement.columnSpan,
      rowSpan: placement.rowSpan,
      element
    }
  })
  for (let row = 1; row <= deck.layout.rows; row++) {
    for (let column = 1; column <= deck.layout.columns; column++) {
      if (!occupied.has(`${column}:${row}`)) slots.push({ column, row, columnSpan: 1, rowSpan: 1 })
    }
  }
  return slots.sort((left, right) => left.row - right.row || left.column - right.column)
}
