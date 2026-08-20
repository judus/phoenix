import { useEffect, useMemo, useRef, useState } from 'react'
import { ControlDeckSurface } from '@jdu/control-deck-ui'
import { PHOENIX_CONTROL_LAYOUT_PRESETS, PhoenixControlDeckThemeSchema, applyControlGridPageLayoutPreset, controlGridLayoutToControlDeckConfiguration, phoenixControlLayoutPreset, type CommandTarget, type ControlGridLayout, type GameActionAvailability, type GameActionOperation, type PhoenixControlDeckTheme, type RuntimeState } from '@phoenix/contracts'
import { Button, CommandTile, Field, IconButton, NumberInput, PageFrame, Select, Status, TextInput } from '@phoenix/ui'
import { createClientId } from '../../application/identity/client-identity.js'
import type { MacroRuntime } from '../../application/macros/macro-runtime.js'
import type { ControlCategory } from '../../application/navigation/phoenix-route.js'
import { controlsCategoryLabel, gameActionCategoryLabel } from './controls-navigation.js'
import type { ControlsControllerSnapshot } from './use-controls-controller.js'
import { HoldGestureController } from './hold-gesture-controller.js'

export function ControlsPage({ category, controller, editing, macros, runtime, onEditingChange, onExecuteAction, onSaveLayout }: {
  category: ControlCategory
  controller: ControlsControllerSnapshot
  editing: boolean
  macros: MacroRuntime
  runtime?: RuntimeState
  onEditingChange(editing: boolean): void
  onExecuteAction(actionId: string, operation: GameActionOperation, leaseId?: string): Promise<unknown>
  onSaveLayout(layout: ControlGridLayout): Promise<ControlGridLayout>
}) {
  const [error, setError] = useState<string>()
  const [draft, setDraft] = useState<ControlGridLayout>()
  const [editingPosition, setEditingPosition] = useState<number>()
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const held = useRef(new HoldGestureController())
  useEffect(() => { if (!editing) setDraft(controller.layout) }, [controller.layout, editing])
  useEffect(() => { onEditingChange(false); setEditingPosition(undefined); setFilter('') }, [category])
  useEffect(() => () => { void held.current.releaseAll() }, [category])
  const activeLayout = draft ?? controller.layout
  const page = activeLayout?.pages.find(candidate => candidate.category === category)
  const deck = useMemo(() => controlGridLayoutToControlDeckConfiguration(activeLayout ?? {
    version: 4,
    pages: [{
      id: category,
      label: controlsCategoryLabel(category),
      category,
      columns: 8,
      rows: 5,
      layoutPresetId: null,
      theme: 'phoenix',
      cells: []
    }]
  }).decks.find(candidate => candidate.context === `phoenix:${category}`)!, [activeLayout, category])
  const actions = new Map(controller.actions?.actions.map(action => [action.definition.id, action]) ?? [])
  const cells = new Map(page?.cells.map(cell => [cell.position, cell]) ?? [])

  const execute = (action: GameActionAvailability, operation: GameActionOperation, leaseId?: string) => {
    const operationRequest = macros.recording
      ? macros.recordAction(action.definition.id, operation)
      : onExecuteAction(action.definition.id, operation, leaseId)
    return operationRequest
      .then(() => setError(undefined))
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Control execution failed.'))
  }

  return (
    <PageFrame className={`controls-page theme-${page?.theme ?? 'phoenix'}${editing ? ' editing' : ''}${macros.recording ? ' recording' : ''}`} layout="fit">
      {macros.recording && <section className="control-recording-toolbar">
        <span className="recording-status">Recording · {macros.recording.entries.length} commands</span>
        <Button variant="quiet" onClick={() => void macros.cancelRecording()}>Cancel</Button>
        <Button variant="primary" onClick={() => void macros.stopRecording()}>Stop and review</Button>
      </section>}
      {editing && page && <DeckSettings
        page={page}
        onChange={updated => draft && setDraft(replacePage(draft, updated))}
        onCancel={() => { setDraft(controller.layout); onEditingChange(false); setEditingPosition(undefined) }}
        onSave={() => {
          if (!draft) return
          setSaving(true)
          void onSaveLayout(draft).then(saved => { setDraft(saved); onEditingChange(false); setError(undefined) }).catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to save control layout.')).finally(() => setSaving(false))
        }}
        saving={saving}
      />}
      {controller.status === 'error' || error || macros.error
        ? <Status tone="danger">{error ?? macros.error ?? controller.error}</Status>
        : controller.status === 'loading'
          ? <Status tone="muted">Loading command grid…</Status>
          : <ControlDeckSurface
              aria-label={`${controlsCategoryLabel(category)} command grid`}
              className="controls controls-command control-deck"
              deck={deck}
              renderEmpty={({ column, row }) => {
                const position = (row - 1) * deck.layout.columns + column
                return editing
                  ? <Button aria-label={`Cell ${position}`} className="control-deck-empty" variant="quiet" onClick={() => { setEditingPosition(position); setFilter('') }}>{position}</Button>
                  : <div className="control-deck-empty" />
              }}
              renderCommand={element => {
                const position = (element.placement.row - 1) * deck.layout.columns + element.placement.column
                const cell = cells.get(position)
                const target = cell?.target
                if (!target) return <div className="control-deck-empty" />
                if (target.type === 'macro') {
                  const macro = macros.library.macros.find(candidate => candidate.id === target.macroId)
                  return <CommandTile kind="macro" label={macro?.name ?? target.macroId} meta={editing ? `Cell ${position}` : macro?.risk} unavailable={!editing && !macro?.enabled} onClick={() => editing ? (setEditingPosition(position), setFilter('')) : macro && void macros.play(macro)} onContextMenu={event => event.preventDefault()} />
                }
                if (target.type !== 'game-action') return <MissingTarget target={target} />
                const action = actions.get(target.actionId)
                if (!action) return <MissingTarget target={target} />
                const active = telemetryState(runtime, action.definition.telemetryKey)
                return <CommandTile
                  binding={action.binding?.display}
                  label={action.definition.label}
                  meta={action.definition.inputMode}
                  selected={active}
                  tone={action.definition.risk === 'dangerous' ? 'danger' : 'normal'}
                  unavailable={!action.available}
                  disabled={!editing && !action.available}
                  onContextMenu={event => event.preventDefault()}
                  onClick={event => {
                    if (editing) { setEditingPosition(position); setFilter(''); return }
                    if (action.definition.inputMode !== 'hold') void execute(action, 'tap')
                    else if (event.detail === 0) {
                      const leaseId = createClientId()
                      void execute(action, 'press', leaseId).then(() => execute(action, 'release', leaseId))
                    }
                  }}
                  onPointerDown={event => {
                    if (editing || action.definition.inputMode !== 'hold') return
                    event.currentTarget.setPointerCapture?.(event.pointerId)
                    held.current.begin(
                      action.definition.id,
                      (operation, leaseId) => execute(action, operation, leaseId),
                      !macros.recording
                    )
                  }}
                  onPointerUp={() => { void held.current.end(action.definition.id) }}
                  onPointerCancel={() => { void held.current.end(action.definition.id) }}
                />
              }}
            />}
      {editing && editingPosition !== undefined && <ControlPicker
        actions={controller.actions?.actions ?? []}
        filter={filter}
        macros={macros}
        onClose={() => setEditingPosition(undefined)}
        onFilterChange={setFilter}
        onSelect={target => {
          if (!draft) return
          setDraft(assignTarget(draft, category, editingPosition, target))
          setEditingPosition(undefined)
        }}
        onClear={() => {
          if (!draft) return
          setDraft(assignTarget(draft, category, editingPosition, null))
          setEditingPosition(undefined)
        }}
        position={editingPosition}
      />}
    </PageFrame>
  )
}

function DeckSettings ({ onCancel, onChange, onSave, page, saving }: {
  onCancel(): void
  onChange(page: ControlGridLayout['pages'][number]): void
  onSave(): void
  page: ControlGridLayout['pages'][number]
  saving: boolean
}) {
  const [columns, setColumns] = useState(String(page.columns))
  const [rows, setRows] = useState(String(page.rows))
  useEffect(() => setColumns(String(page.columns)), [page.columns])
  useEffect(() => setRows(String(page.rows)), [page.rows])
  const locked = page.layoutPresetId !== null
  const presets = page.category === 'ship' ? PHOENIX_CONTROL_LAYOUT_PRESETS : []
  return <section aria-label="Deck settings" className="control-deck-settings">
    <Field htmlFor="control-deck-name" label="Deck">
      <TextInput maxLength={32} value={page.label} onChange={event => {
        if (event.target.value.trim()) onChange({ ...page, label: event.target.value })
      }} />
    </Field>
    <Field htmlFor="control-deck-layout" label="Layout">
      <Select value={page.layoutPresetId ?? ''} onChange={event => {
        const preset = event.target.value === '' ? null : phoenixControlLayoutPreset(event.target.value)
        if (event.target.value !== '' && !preset) return
        onChange(applyControlGridPageLayoutPreset(page, preset ?? null))
      }}>
        <option value="">Custom</option>
        {presets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
      </Select>
    </Field>
    <Field htmlFor="control-deck-columns" label="Columns">
      <NumberInput disabled={locked} min={2} max={12} value={columns}
        onBlur={() => setColumns(String(page.columns))}
        onChange={event => {
          setColumns(event.target.value)
          const nextColumns = boundedInteger(event.target.value, 2, 12)
          if (nextColumns !== undefined) onChange(resizePage(page, nextColumns, page.rows))
        }} />
    </Field>
    <Field htmlFor="control-deck-rows" label="Rows">
      <NumberInput disabled={locked} min={1} max={12} value={rows}
        onBlur={() => setRows(String(page.rows))}
        onChange={event => {
          setRows(event.target.value)
          const nextRows = boundedInteger(event.target.value, 1, 12)
          if (nextRows !== undefined) onChange(resizePage(page, page.columns, nextRows))
        }} />
    </Field>
    <Field htmlFor="control-deck-theme" label="Theme">
      <Select value={page.theme ?? 'phoenix'} onChange={event => onChange({
        ...page,
        theme: PhoenixControlDeckThemeSchema.parse(event.target.value)
      })}>
        {['phoenix', 'blue', 'cyan', 'green', 'amber', 'orange', 'red', 'violet', 'magenta'].map(theme => <option key={theme} value={theme}>{themeLabel(PhoenixControlDeckThemeSchema.parse(theme))}</option>)}
      </Select>
    </Field>
    <IconButton label="Cancel layout editing" size="md" variant="quiet" onClick={onCancel}><CrossIcon /></IconButton>
    <IconButton busy={saving} label="Save layout" size="md" variant="primary" onClick={onSave}><CheckIcon /></IconButton>
  </section>
}

function CrossIcon () {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg>
}

function CheckIcon () {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>
}

function ControlPicker({ actions, filter, macros, onClear, onClose, onFilterChange, onSelect, position }: {
  actions: GameActionAvailability[]
  filter: string
  macros: MacroRuntime
  onClear(): void
  onClose(): void
  onFilterChange(value: string): void
  onSelect(target: CommandTarget): void
  position: number
}) {
  const needle = filter.trim().toLowerCase()
  const candidates = useMemo(() => actions.filter(action => !needle || [
    action.definition.label,
    action.definition.eliteBinding,
    gameActionCategoryLabel(action.definition.category),
    action.binding?.display
  ].some(value => value?.toLowerCase().includes(needle))), [actions, needle])
  return <section aria-modal="true" className="control-picker" role="dialog">
    <header><div><strong>Assign command</strong><small>Cell {position}</small></div><Button variant="quiet" onClick={onClose}>Close</Button></header>
    <Field htmlFor="control-filter" label="Filter commands"><TextInput autoFocus value={filter} onChange={event => onFilterChange(event.target.value)} /></Field>
    <div className="control-picker-list">
      {macros.library.macros.filter(macro => !needle || macro.name.toLowerCase().includes(needle)).map(macro => <Button alignment="start" key={macro.id} variant="quiet" onClick={() => onSelect({ type: 'macro', macroId: macro.id })}>{macro.name} · Macro</Button>)}
      {candidates.map(action => <Button alignment="start" key={action.definition.id} variant="quiet" onClick={() => onSelect({ type: 'game-action', actionId: action.definition.id })}>{controlPickerActionLabel(action)}</Button>)}
    </div>
    <footer><Button variant="danger" onClick={onClear}>Clear cell</Button></footer>
  </section>
}

export function controlPickerActionLabel(action: GameActionAvailability): string {
  return `${action.definition.label} · ${gameActionCategoryLabel(action.definition.category)} · ${action.binding?.display ?? 'Unbound'}`
}

function assignTarget(layout: ControlGridLayout, category: ControlCategory, position: number, target: CommandTarget | null): ControlGridLayout {
  return {
    ...layout,
    pages: layout.pages.map(page => {
      if (page.category !== category) return page
      return {
        ...page,
        cells: page.cells.some(cell => cell.position === position)
          ? page.cells.map(cell => cell.position === position ? { ...cell, target } : cell)
          : [...page.cells, { position, span: 1, target }].sort((left, right) => left.position - right.position)
      }
    })
  }
}

function replacePage (layout: ControlGridLayout, replacement: ControlGridLayout['pages'][number]): ControlGridLayout {
  return { ...layout, pages: layout.pages.map(page => page.category === replacement.category ? replacement : page) }
}

export function resizePage (
  page: ControlGridLayout['pages'][number],
  columns: number,
  rows: number
): ControlGridLayout['pages'][number] {
  return {
    ...page,
    columns,
    rows,
    cells: page.cells.flatMap(cell => {
      const column = (cell.position - 1) % page.columns + 1
      const row = Math.floor((cell.position - 1) / page.columns) + 1
      return row <= rows && column + cell.span - 1 <= columns
        ? [{ ...cell, position: (row - 1) * columns + column }]
        : []
    })
  }
}

function boundedInteger (candidate: string, minimum: number, maximum: number): number | undefined {
  if (candidate.trim() === '') return undefined
  const value = Number(candidate)
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : undefined
}

function themeLabel (theme: PhoenixControlDeckTheme): string {
  return `${theme.charAt(0).toUpperCase()}${theme.slice(1)}`
}

function MissingTarget({ target }: { target: CommandTarget }) {
  const label = target.type === 'navigation' ? target.destinationId : target.type === 'macro' ? target.macroId : target.actionId
  return <CommandTile label={label} unavailable />
}

function telemetryState(runtime: RuntimeState | undefined, key: string | null): boolean {
  if (!key || !runtime?.gameStatus) return false
  return (runtime.gameStatus.flags as unknown as Record<string, boolean>)[key] === true
}
