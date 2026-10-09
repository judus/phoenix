import type { CSSProperties, ReactNode } from 'react'
import type { ControlDeckGridCommandElement, ControlDeckGridDeck, ControlDeckGridSpacerElement } from 'control-deck/core'
import { useButtonMove } from './use-button-move.js'

interface EmptyCell {
  column: number
  row: number
  spacer?: ControlDeckGridSpacerElement
}

interface SurfaceSlot {
  column: number
  row: number
  columnSpan: number
  rowSpan: number
  element?: ControlDeckGridCommandElement | ControlDeckGridSpacerElement
}

export function ControlSurface({
  'aria-label': ariaLabel,
  className,
  deck,
  onMove,
  renderCommand,
  renderEmpty
}: {
  'aria-label': string
  className?: string
  deck: ControlDeckGridDeck
  onMove?(elementId: string, column: number, row: number): void
  renderCommand(element: ControlDeckGridCommandElement): ReactNode
  renderEmpty(cell: EmptyCell): ReactNode
}) {
  const move = useButtonMove(Boolean(onMove), deck, (id, column, row) => onMove?.(id, column, row))
  const previewElement = move.preview && deck.elements.find(element => element.id === move.preview?.id)
  const style: CSSProperties = {
    gridTemplateColumns: `repeat(${deck.layout.columns}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${deck.layout.rows}, minmax(0, 1fr))`
  }

  return <div
    aria-label={ariaLabel}
    className={['control-deck-surface', className].filter(Boolean).join(' ')}
    data-deskplane-no-swipe={onMove ? '' : undefined}
    ref={move.surface}
    {...move.events}
    role="group"
    style={style}
  >
    {surfaceSlots(deck).map(slot => {
      const element = slot.element
      const key = `${slot.column}:${slot.row}`
      return <div
        className={`control-deck-slot${move.sourceSlot === key ? ' moving' : ''}${move.destination === key ? ' drop-target' : ''}`}
        data-element-id={element?.id}
        data-move-slot={key}
        key={element?.id ?? `empty_${slot.column}_${slot.row}`}
        style={{
          gridColumn: `${slot.column} / span ${slot.columnSpan}`,
          gridRow: `${slot.row} / span ${slot.rowSpan}`
        }}
      >
        {element?.kind === 'command'
          ? renderCommand(element)
          : renderEmpty({ column: slot.column, row: slot.row, spacer: element })}
        {onMove && element?.kind === 'command' && <button
          aria-label={`Move button at ${slot.column}:${slot.row}`}
          aria-pressed={move.sourceSlot === key}
          className="control-deck-move-handle"
          title="Drag to move or swap. Or select, then choose a destination. Escape cancels."
          type="button"
          onPointerDown={event => move.begin(event, element.id, key)}
          onClick={() => move.select(element.id, key)}
        />}
      </div>
    })}
    {move.preview && previewElement?.kind === 'command' && <div
      aria-hidden="true"
      inert
      className="control-deck-drag-preview"
      style={{ left: move.preview.left, top: move.preview.top, width: move.preview.width, height: move.preview.height, transform: `translate(${move.preview.x}px, ${move.preview.y}px)` }}
    >{renderCommand(previewElement)}</div>}
  </div>
}

function surfaceSlots(deck: ControlDeckGridDeck): SurfaceSlot[] {
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
