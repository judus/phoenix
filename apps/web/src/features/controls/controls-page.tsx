import { useEffect, useMemo, useRef, useState } from 'react'
import { gameActionCommandId, macroCommandId, type CommandOperation, type ControlGridLayout, type GameActionAvailability, type RuntimeState } from '@phoenix/contracts'
import { Button, CommandTile, ControlContext, Field, PageFrame, PageHeader, Status, TextInput } from '@phoenix/ui'
import type { MacroRuntime } from '../../application/macros/macro-runtime.js'
import type { ControlCategory } from '../../application/navigation/phoenix-route.js'
import { controlsCategoryLabel } from './controls-navigation.js'
import type { ControlsControllerSnapshot } from './use-controls-controller.js'

export function ControlsPage({ category, controller, editing, macros, runtime, onEditingChange, onExecuteCommand, onSaveLayout }: {
  category: ControlCategory
  controller: ControlsControllerSnapshot
  editing: boolean
  macros: MacroRuntime
  runtime?: RuntimeState
  onEditingChange(editing: boolean): void
  onExecuteCommand(commandId: string, operation: CommandOperation, leaseId?: string): Promise<unknown>
  onSaveLayout(layout: ControlGridLayout): Promise<ControlGridLayout>
}) {
  const [error, setError] = useState<string>()
  const [draft, setDraft] = useState<ControlGridLayout>()
  const [editingPosition, setEditingPosition] = useState<number>()
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const held = useRef(new Map<string, string>())
  const executeCommand = useRef(onExecuteCommand)
  useEffect(() => { executeCommand.current = onExecuteCommand }, [onExecuteCommand])
  useEffect(() => { if (!editing) setDraft(controller.layout) }, [controller.layout, editing])
  useEffect(() => { onEditingChange(false); setEditingPosition(undefined); setFilter('') }, [category])
  useEffect(() => () => {
    for (const [commandId, leaseId] of held.current) {
      held.current.delete(commandId)
      void executeCommand.current(commandId, 'release', leaseId)
    }
  }, [category])
  const activeLayout = draft ?? controller.layout
  const page = activeLayout?.pages.find(candidate => candidate.groupId === category)
  const actions = new Map(controller.actions?.actions.map(action => [gameActionCommandId(action.definition.id), action]) ?? [])
  const capacity = (page?.columns ?? 8) * (page?.rows ?? 5)
  const cells = new Map(page?.cells.map(cell => [cell.position, cell]) ?? [])
  const covered = new Set<number>()
  for (const cell of page?.cells ?? []) for (let offset = 1; offset < cell.span; offset++) covered.add(cell.position + offset)

  const execute = (commandId: string, operation: CommandOperation, leaseId?: string) => {
    const operationRequest = macros.recording
      ? macros.recordCommand(commandId, operation)
      : onExecuteCommand(commandId, operation, leaseId)
    return operationRequest
      .then(() => setError(undefined))
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Control execution failed.'))
  }

  return (
    <PageFrame className={`controls-page${editing ? ' editing' : ''}`} layout="fit">
      <PageHeader
        actions={macros.recording
          ? <><span className="recording-status">Recording · {macros.recording.entries.length} commands</span><Button variant="quiet" onClick={() => void macros.cancelRecording()}>Cancel</Button><Button variant="primary" onClick={() => void macros.stopRecording()}>Stop and review</Button></>
          : editing
            ? <><Button variant="quiet" onClick={() => { setDraft(controller.layout); onEditingChange(false); setEditingPosition(undefined) }}>Cancel</Button><Button busy={saving} variant="primary" onClick={() => {
              if (!draft) return
              setSaving(true)
              void onSaveLayout(draft).then(saved => { setDraft(saved); onEditingChange(false); setError(undefined) }).catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to save control layout.')).finally(() => setSaving(false))
            }}>Save layout</Button></>
            : null}
        context="Controls"
        title={controlsCategoryLabel(category)}
      />
      {controller.status === 'error' || error || macros.error
        ? <Status tone="danger">{error ?? macros.error ?? controller.error}</Status>
        : controller.status === 'loading'
          ? <Status tone="muted">Loading command grid…</Status>
          : <ControlContext
              aria-label={`${controlsCategoryLabel(category)} command grid`}
              className="control-deck"
              context="command"
              style={{ gridTemplateColumns: `repeat(${page?.columns ?? 8}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${page?.rows ?? 5}, minmax(0, 1fr))` }}
            >
              {Array.from({ length: capacity }, (_, index) => index + 1).map(position => {
                if (covered.has(position)) return null
                const cell = cells.get(position)
                const commandId = cell?.commandId
                if (!commandId) return editing
                  ? <Button aria-label={`Cell ${position}`} className="control-deck-empty" key={position} variant="quiet" onClick={() => { setEditingPosition(position); setFilter('') }} style={{ gridColumn: `span ${cell?.span ?? 1}` }}>{position}</Button>
                  : <div className="control-deck-empty" key={position} style={{ gridColumn: `span ${cell?.span ?? 1}` }} />
                if (commandId.startsWith(macroCommandId(''))) {
                  const macroId = commandId.slice(macroCommandId('').length)
                  const macro = macros.library.macros.find(candidate => candidate.id === macroId)
                  return <CommandTile key={position} kind="macro" label={macro?.name ?? macroId} meta={editing ? `Cell ${position}` : macro?.risk} unavailable={!editing && !macro?.enabled} onClick={() => editing ? (setEditingPosition(position), setFilter('')) : macro && void macros.play(macro)} style={{ gridColumn: `span ${cell?.span ?? 1}` }} />
                }
                const action = actions.get(commandId)
                if (!action) return <MissingCommand key={position} commandId={commandId} span={cell?.span ?? 1} />
                const active = telemetryState(runtime, action.definition.telemetryKey)
                return <CommandTile
                  binding={action.binding?.display}
                  key={position}
                  label={action.definition.label}
                  meta={action.definition.inputMode}
                  selected={active}
                  tone={action.definition.risk === 'dangerous' ? 'danger' : 'normal'}
                  unavailable={!action.available}
                  onClick={event => {
                    if (editing) { setEditingPosition(position); setFilter(''); return }
                    if (action.definition.inputMode !== 'hold') void execute(commandId, 'tap')
                    else if (event.detail === 0) {
                      const leaseId = globalThis.crypto.randomUUID()
                      void execute(commandId, 'press', leaseId).then(() => execute(commandId, 'release', leaseId))
                    }
                  }}
                  onPointerDown={event => {
                    if (editing || action.definition.inputMode !== 'hold' || held.current.has(commandId)) return
                    event.currentTarget.setPointerCapture?.(event.pointerId)
                    const leaseId = globalThis.crypto.randomUUID()
                    held.current.set(commandId, leaseId)
                    void execute(commandId, 'press', leaseId)
                  }}
                  onPointerUp={() => {
                    const leaseId = held.current.get(commandId)
                    if (leaseId) { held.current.delete(commandId); void execute(commandId, 'release', leaseId) }
                  }}
                  onPointerCancel={() => {
                    const leaseId = held.current.get(commandId)
                    if (leaseId) { held.current.delete(commandId); void execute(commandId, 'release', leaseId) }
                  }}
                  style={{ gridColumn: `span ${cell?.span ?? 1}` }}
                />
              })}
            </ControlContext>}
      {editing && editingPosition !== undefined && <ControlPicker
        actions={controller.actions?.actions ?? []}
        filter={filter}
        macros={macros}
        onClose={() => setEditingPosition(undefined)}
        onFilterChange={setFilter}
        onSelect={commandId => {
          if (!draft) return
          setDraft(assignCommand(draft, category, editingPosition, commandId))
          setEditingPosition(undefined)
        }}
        onClear={() => {
          if (!draft) return
          setDraft(assignCommand(draft, category, editingPosition, null))
          setEditingPosition(undefined)
        }}
        position={editingPosition}
      />}
    </PageFrame>
  )
}

function ControlPicker({ actions, filter, macros, onClear, onClose, onFilterChange, onSelect, position }: {
  actions: GameActionAvailability[]
  filter: string
  macros: MacroRuntime
  onClear(): void
  onClose(): void
  onFilterChange(value: string): void
  onSelect(commandId: string): void
  position: number
}) {
  const needle = filter.trim().toLowerCase()
  const candidates = useMemo(() => actions.filter(action => !needle || [action.definition.label, action.definition.eliteBinding, action.binding?.display].some(value => value?.toLowerCase().includes(needle))), [actions, needle])
  return <section aria-modal="true" className="control-picker" role="dialog">
    <header><div><strong>Assign command</strong><small>Cell {position}</small></div><Button variant="quiet" onClick={onClose}>Close</Button></header>
    <Field htmlFor="control-filter" label="Filter commands"><TextInput autoFocus value={filter} onChange={event => onFilterChange(event.target.value)} /></Field>
    <div className="control-picker-list">
      {macros.library.macros.filter(macro => !needle || macro.name.toLowerCase().includes(needle)).map(macro => <Button alignment="start" key={macro.id} variant="quiet" onClick={() => onSelect(macroCommandId(macro.id))}>{macro.name} · Macro</Button>)}
      {candidates.map(action => <Button alignment="start" key={action.definition.id} variant="quiet" onClick={() => onSelect(gameActionCommandId(action.definition.id))}>{action.definition.label} · {action.binding?.display ?? 'Unbound'}</Button>)}
    </div>
    <footer><Button variant="danger" onClick={onClear}>Clear cell</Button></footer>
  </section>
}

function assignCommand(layout: ControlGridLayout, category: ControlCategory, position: number, commandId: string | null): ControlGridLayout {
  return {
    ...layout,
    pages: layout.pages.map(page => {
      if (page.groupId !== category) return page
      return {
        ...page,
        cells: page.cells.some(cell => cell.position === position)
          ? page.cells.map(cell => cell.position === position ? { ...cell, commandId } : cell)
          : [...page.cells, { position, span: 1, commandId }].sort((left, right) => left.position - right.position)
      }
    })
  }
}

function MissingCommand({ commandId, span }: { commandId: string, span: number }) {
  return <CommandTile label={commandId} unavailable style={{ gridColumn: `span ${span}` }} />
}

function telemetryState(runtime: RuntimeState | undefined, key: string | null): boolean {
  if (!key || !runtime?.gameStatus) return false
  return (runtime.gameStatus.flags as unknown as Record<string, boolean>)[key] === true
}
