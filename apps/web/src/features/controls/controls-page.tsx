import { useEffect, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes } from 'react'
import {
  applyControlDeckLayoutPreset,
  removeControlDeckElement,
  replaceControlDeck,
  replaceControlDeckGroup,
  resolveControlDeckInteraction,
  upsertControlDeckElement,
  useCustomControlDeckLayout,
  type ControlDeckGridDeck,
  type ControlDeckDeckGroup
} from 'control-deck/core'
import { PHOENIX_CONTROL_LAYOUT_PRESETS, PhoenixControlDeckThemeSchema, controlDeckTargetToPhoenixTarget, phoenixControlLayoutPreset, type CommandTarget, type GameActionAvailability, type GameActionOperation, type PhoenixControlDeckConfiguration, type PhoenixControlDeckTheme, type RuntimeState } from '@phoenix/contracts'
import { Breadcrumbs, Button, CommandTile, ControlContext, DataTable, NumberInput, PageFrame, PageHeader, Select, Status, TileButton, Widget } from '@phoenix/ui'
import { createClientId } from '../../application/identity/client-identity.js'
import type { MacroRuntime } from '../../application/macros/macro-runtime.js'
import type { ControlCategory } from '../../application/navigation/phoenix-route.js'
import { controlsCategoryLabel, gameActionCategoryLabel } from './controls-navigation.js'
import type { ControlsControllerSnapshot } from './use-controls-controller.js'
import { HoldGestureController } from './hold-gesture-controller.js'
import { ArmingController } from './arming-controller.js'
import { ButtonEditor } from './button-editor.js'
import { ControlSurface } from './control-surface.js'

export function ControlsPage({ category, controller, editing, macros, runtime, onEditingChange, onExecuteAction, onSaveConfiguration }: {
  category: ControlCategory
  controller: ControlsControllerSnapshot
  editing: boolean
  macros: MacroRuntime
  runtime?: RuntimeState
  onEditingChange(editing: boolean): void
  onExecuteAction(actionId: string, operation: GameActionOperation, leaseId?: string): Promise<unknown>
  onSaveConfiguration(configuration: PhoenixControlDeckConfiguration): Promise<PhoenixControlDeckConfiguration>
}) {
  const [error, setError] = useState<string>()
  const [draft, setDraft] = useState<PhoenixControlDeckConfiguration>()
  const [editingPosition, setEditingPosition] = useState<number>()
  const [saving, setSaving] = useState(false)
  const held = useRef(new HoldGestureController())
  const arming = useRef(new ArmingController()).current
  const armingTimers = useRef(new Map<number, ReturnType<typeof globalThis.setTimeout>>())
  const suppressClicks = useRef(new Set<string>())
  const armedElementId = useSyncExternalStore(arming.subscribe, arming.getSnapshot, arming.getSnapshot)
  useEffect(() => { if (!editing) setDraft(controller.configuration) }, [controller.configuration, editing])
  useEffect(() => { onEditingChange(false); setEditingPosition(undefined); arming.cancel() }, [category])
  useEffect(() => {
    if (editing) arming.cancel()
  }, [arming, editing])
  useEffect(() => () => {
    void held.current.releaseAll()
    for (const timer of armingTimers.current.values()) globalThis.clearTimeout(timer)
    armingTimers.current.clear()
    arming.cancel()
  }, [arming, category])
  const activeConfiguration = draft ?? controller.configuration
  const deck = activeConfiguration?.decks.find(candidate => candidate.context === `phoenix:${category}`)
  const group = deck?.groupId ? activeConfiguration?.groups?.find(candidate => candidate.id === deck.groupId) : undefined
  const actions = new Map(controller.actions?.actions.map(action => [action.definition.id, action]) ?? [])
  const editorColumn = editingPosition === undefined || !deck ? undefined : (editingPosition - 1) % deck.layout.columns + 1
  const editorRow = editingPosition === undefined || !deck ? undefined : Math.floor((editingPosition - 1) / deck.layout.columns) + 1
  const editorSlot = editorColumn === undefined || editorRow === undefined
    ? undefined
    : deck?.elements.find(element => element.placement.column === editorColumn && element.placement.row === editorRow)
  const editorElement = editorSlot?.kind === 'command' ? editorSlot : undefined

  const execute = (action: GameActionAvailability, operation: GameActionOperation, leaseId?: string) => {
    const operationRequest = macros.recording
      ? macros.recordAction(action.definition.id, operation)
      : onExecuteAction(action.definition.id, operation, leaseId)
    return operationRequest
      .then(() => setError(undefined))
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Control execution failed.'))
  }

  const beginSafetyHold = (elementId: string, armedForMs: number, pointerId: number) => {
    if (armedElementId === elementId) return
    arming.cancel()
    const existing = armingTimers.current.get(pointerId)
    if (existing) globalThis.clearTimeout(existing)
    armingTimers.current.set(pointerId, globalThis.setTimeout(() => {
      armingTimers.current.delete(pointerId)
      suppressClicks.current.add(elementId)
      arming.arm(elementId, armedForMs)
    }, 650))
  }
  const finishSafetyHold = (elementId: string, pointerId: number) => {
    const timer = armingTimers.current.get(pointerId)
    if (timer) globalThis.clearTimeout(timer)
    armingTimers.current.delete(pointerId)
    if (suppressClicks.current.has(elementId)) {
      globalThis.setTimeout(() => suppressClicks.current.delete(elementId), 0)
    }
  }
  const confirmSafety = (elementId: string): boolean => {
    if (suppressClicks.current.delete(elementId)) return false
    return arming.confirm(elementId)
  }

  return (
    <PageFrame className={`controls-page theme-${controlDeckTheme(deck, group)}${editing ? ' editing' : ''}${editingPosition !== undefined ? ' button-editing' : ''}${macros.recording ? ' recording' : ''}`} layout="fit">
      {macros.recording && <section className="control-recording-toolbar">
        <span className="recording-status">Recording · {macros.recording.entries.length} commands</span>
        <Button variant="quiet" onClick={() => void macros.cancelRecording()}>Cancel</Button>
        <Button variant="primary" onClick={() => void macros.stopRecording()}>Stop and save</Button>
      </section>}
      {editing && editingPosition === undefined && activeConfiguration && deck && group && <DeckSettings
        configuration={activeConfiguration}
        deck={deck}
        group={group}
        onChange={setDraft}
        onCancel={() => {
          setDraft(controller.configuration)
          setError(undefined)
          onEditingChange(false)
        }}
        onSave={() => {
          if (!draft) return
          setSaving(true)
          void onSaveConfiguration(draft).then(saved => { setDraft(saved); onEditingChange(false); setError(undefined) }).catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to save Control Deck configuration.')).finally(() => setSaving(false))
        }}
        saving={saving}
      />}
      {editing && editingPosition !== undefined && editorColumn !== undefined && editorRow !== undefined && <PageHeader
        context={<Breadcrumbs items={[{ label: 'Controls' }, { label: controlsCategoryLabel(category) }]} />}
        title={`Button Slot ${editorColumn}:${editorRow}`}
        variant="cockpit"
      />}
      {controller.status === 'error' || error || macros.error
        ? <Status tone="danger">{error ?? macros.error ?? controller.error}</Status>
        : controller.status === 'loading'
          ? <Status tone="muted">Loading command grid…</Status>
          : !deck || !activeConfiguration
            ? <Status tone="danger">The PHOENIX Control Deck configuration is incomplete.</Status>
          : editing && editingPosition !== undefined && editorColumn !== undefined && editorRow !== undefined
            ? <div className="phoenix-control-deck">
                <ButtonEditor
                  catalogue={controller.commands}
                  element={editorElement}
                  placement={editorSlot?.placement ?? {
                    kind: 'grid',
                    column: editorColumn,
                    row: editorRow,
                    columnSpan: 1,
                    rowSpan: 1
                  }}
                  position={{ column: editorColumn, row: editorRow }}
                  renderCommandOptions={({ label, onSelect, options, selectedCommandId }) => <DataTable
                    className="control-command-table"
                    density="compact"
                    label={label}
                    narrow="priority"
                    scheme="surface"
                    stickyHeader
                  >
                    <thead><tr><th>Command</th><th>Context</th><th>Binding</th></tr></thead>
                    <tbody>{options.map(option => <tr
                      aria-selected={option.commandId === selectedCommandId || undefined}
                      className={option.commandId === selectedCommandId ? 'active' : undefined}
                      key={option.commandId}
                      onClick={() => onSelect(option)}
                      onKeyDown={event => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        onSelect(option)
                      }}
                      tabIndex={0}
                    >
                      <td><strong>{option.label}</strong>{!option.available && <small>{option.unavailableReason ?? 'Unavailable'}</small>}</td>
                      <td>{option.category}{option.risk !== 'safe' ? <small>{option.risk}</small> : null}</td>
                      <td>{option.bindingLabel ?? 'Unbound'}</td>
                    </tr>)}</tbody>
                  </DataTable>}
                  showBackButton={false}
                  showHeader={false}
                  onClose={() => setEditingPosition(undefined)}
                  onRemove={() => {
                    if (!draft || !editorSlot) return
                    setDraft(replaceControlDeck(draft, removeControlDeckElement(deck, editorSlot.id)))
                    setEditingPosition(undefined)
                  }}
                  onSave={element => {
                    if (!draft) return
                    setDraft(replaceControlDeck(draft, upsertControlDeckElement(deck, element)))
                    setEditingPosition(undefined)
                  }}
                />
              </div>
            : <ControlSurface
              aria-label={`${controlsCategoryLabel(category)} command grid`}
              className="controls controls-command control-deck"
              deck={deck}
              renderEmpty={({ column, row }) => {
                const position = (row - 1) * deck.layout.columns + column
                return editing
                  ? <Button aria-label={`Cell ${position}`} className="control-deck-empty" variant="quiet" onClick={() => setEditingPosition(position)}>{position}</Button>
                  : <div className="control-deck-empty" />
              }}
              renderCommand={element => {
                const position = (element.placement.row - 1) * deck.layout.columns + element.placement.column
                const target = controlDeckTargetToPhoenixTarget(element.target)
                if (target.type === 'macro') {
                  const macro = macros.library.macros.find(candidate => candidate.id === target.macroId)
                  const elementId = element.id
                  const confirmation = element.interaction.confirmation
                  const armed = armedElementId === elementId
                  const interaction = resolveControlDeckInteraction(element.interaction, 'tap')
                  return <ControlDeckCommandTile
                    binding="Macro"
                    label={macro?.name ?? target.macroId}
                    interaction={armed ? 'tap' : interaction.interactionHint}
                    kind="macro"
                    selected={armed}
                    unavailable={!editing && !macro?.enabled}
                    onClick={() => {
                      if (editing) { setEditingPosition(position); return }
                      if (!macro) return
                      if (confirmation?.kind === 'arm-then-tap') {
                        if (!confirmSafety(elementId)) return
                      } else arming.cancel()
                      void macros.play(macro)
                    }}
                    onContextMenu={event => event.preventDefault()}
                    onPointerDown={event => {
                      if (editing) return
                      event.currentTarget.setPointerCapture?.(event.pointerId)
                      if (confirmation?.kind === 'arm-then-tap') beginSafetyHold(elementId, confirmation.armedForMs, event.pointerId)
                      else arming.cancel()
                    }}
                    onPointerUp={event => finishSafetyHold(elementId, event.pointerId)}
                    onPointerCancel={event => finishSafetyHold(elementId, event.pointerId)}
                  />
                }
                if (target.type !== 'game-action') return <MissingTarget target={target} />
                const action = actions.get(target.actionId)
                if (!action) return <MissingTarget target={target} />
                const active = telemetryState(runtime, action.definition.telemetryKey)
                const elementId = element.id
                const confirmation = element.interaction.confirmation
                const armed = armedElementId === elementId
                const interaction = resolveControlDeckInteraction(element.interaction, action.definition.inputMode)
                return <ControlDeckCommandTile
                  binding={action.binding?.display ?? 'Unbound'}
                  label={action.definition.label}
                  interaction={armed ? 'tap' : interaction.interactionHint}
                  selected={armed || active}
                  tone={action.definition.risk === 'dangerous' ? 'danger' : 'normal'}
                  unavailable={!action.available}
                  disabled={!editing && !action.available}
                  onContextMenu={event => event.preventDefault()}
                  onClick={event => {
                    if (editing) { setEditingPosition(position); return }
                    if (confirmation?.kind === 'arm-then-tap') {
                      if (!confirmSafety(elementId)) return
                      void execute(action, 'tap')
                      return
                    }
                    arming.cancel()
                    if (action.definition.inputMode !== 'hold') void execute(action, 'tap')
                    else if (event.detail === 0) {
                      const leaseId = createClientId()
                      void execute(action, 'press', leaseId).then(() => execute(action, 'release', leaseId))
                    }
                  }}
                  onPointerDown={event => {
                    if (editing) return
                    event.currentTarget.setPointerCapture?.(event.pointerId)
                    if (confirmation?.kind === 'arm-then-tap') {
                      beginSafetyHold(elementId, confirmation.armedForMs, event.pointerId)
                      return
                    }
                    arming.cancel()
                    if (action.definition.inputMode !== 'hold') return
                    held.current.begin(
                      action.definition.id,
                      (operation, leaseId) => execute(action, operation, leaseId),
                      !macros.recording
                    )
                  }}
                  onPointerUp={event => {
                    finishSafetyHold(elementId, event.pointerId)
                    void held.current.end(action.definition.id)
                  }}
                  onPointerCancel={event => {
                    finishSafetyHold(elementId, event.pointerId)
                    void held.current.end(action.definition.id)
                  }}
                />
              }}
            />}
    </PageFrame>
  )
}

function DeckSettings ({ configuration, deck, group, onChange, onCancel, onSave, saving }: {
  configuration: PhoenixControlDeckConfiguration
  deck: ControlDeckGridDeck
  group: ControlDeckDeckGroup
  onChange(configuration: PhoenixControlDeckConfiguration): void
  onCancel(): void
  onSave(): void
  saving: boolean
}) {
  const [columns, setColumns] = useState(String(deck.layout.columns))
  const [rows, setRows] = useState(String(deck.layout.rows))
  useEffect(() => setColumns(String(deck.layout.columns)), [deck.layout.columns])
  useEffect(() => setRows(String(deck.layout.rows)), [deck.layout.rows])
  const locked = Boolean(deck.layoutPresetId)
  const presets = deck.context === 'phoenix:ship' ? PHOENIX_CONTROL_LAYOUT_PRESETS : []
  return <section aria-label="Deck settings" className="control-deck-settings widget-command-row">
    <Widget aria-label="Deck layout settings" className="control-deck-settings-form">
      <ControlContext className="control-deck-settings-controls" density="compact">
        <Select aria-label="Deck layout" className="form-mini" value={deck.layoutPresetId ?? ''} onChange={event => {
          const preset = event.target.value === '' ? null : phoenixControlLayoutPreset(event.target.value)
          if (event.target.value !== '' && !preset) return
          onChange(replaceControlDeck(configuration, preset
            ? applyControlDeckLayoutPreset(deck, preset)
            : useCustomControlDeckLayout(deck)))
        }}>
          <option value="">Custom</option>
          {presets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
        </Select>
        <NumberInput aria-label="Deck columns" className="form-mini" disabled={locked} min={1} max={12} value={columns}
          onBlur={() => setColumns(String(deck.layout.columns))}
          onChange={event => {
            setColumns(event.target.value)
            const nextColumns = boundedInteger(event.target.value, 1, 12)
            if (nextColumns !== undefined) onChange(replaceControlDeck(configuration, resizeDeck(deck, nextColumns, deck.layout.rows)))
          }} />
        <NumberInput aria-label="Deck rows" className="form-mini" disabled={locked} min={1} max={12} value={rows}
          onBlur={() => setRows(String(deck.layout.rows))}
          onChange={event => {
            setRows(event.target.value)
            const nextRows = boundedInteger(event.target.value, 1, 12)
            if (nextRows !== undefined) onChange(replaceControlDeck(configuration, resizeDeck(deck, deck.layout.columns, nextRows)))
          }} />
        <Select aria-label="Deck theme" className="form-mini" value={controlDeckTheme(deck, group)} onChange={event => {
          const theme = PhoenixControlDeckThemeSchema.parse(event.target.value)
          const { appearance: _appearance, ...plainGroup } = group
          onChange(replaceControlDeckGroup(configuration, theme === 'phoenix'
            ? plainGroup
            : { ...plainGroup, appearance: { colorScheme: theme } }))
        }}>
          {['phoenix', 'blue', 'cyan', 'green', 'amber', 'orange', 'red', 'violet', 'magenta'].map(theme => <option key={theme} value={theme}>{themeLabel(PhoenixControlDeckThemeSchema.parse(theme))}</option>)}
        </Select>
      </ControlContext>
    </Widget>
    <CommandTile compact details={false} label="Cancel" unavailable={saving} onClick={onCancel} />
    <CommandTile compact details={false} label={saving ? 'Saving…' : 'Save'} unavailable={saving} onClick={onSave} />
  </section>
}

export function controlPickerActionLabel(action: GameActionAvailability): string {
  return `${action.definition.label} · ${gameActionCategoryLabel(action.definition.category)} · ${action.binding?.display ?? 'Unbound'}`
}

export function resizeDeck (
  deck: ControlDeckGridDeck,
  columns: number,
  rows: number
): ControlDeckGridDeck {
  return {
    ...deck,
    layout: { kind: 'grid', columns, rows },
    elements: deck.elements.filter(element =>
      element.placement.row + element.placement.rowSpan - 1 <= rows &&
      element.placement.column + element.placement.columnSpan - 1 <= columns)
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

function controlDeckTheme (deck: ControlDeckGridDeck | undefined, group: ControlDeckDeckGroup | undefined): PhoenixControlDeckTheme {
  return group?.appearance?.colorScheme ?? deck?.appearance?.colorScheme ?? 'phoenix'
}

function MissingTarget({ target }: { target: CommandTarget }) {
  const label = target.type === 'navigation' ? target.destinationId : target.type === 'macro' ? target.macroId : target.actionId
  return <ControlDeckCommandTile binding="Unbound" interaction="tap" label={label} unavailable />
}

function ControlDeckCommandTile({ binding, interaction, kind = 'action', label, selected = false, tone = 'normal', unavailable = false, disabled = unavailable, className, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  binding?: string
  interaction: 'tap' | 'hold' | 'arm'
  kind?: 'action' | 'macro'
  label: string
  selected?: boolean
  tone?: 'normal' | 'danger'
  unavailable?: boolean
}) {
  return <TileButton
    aria-label={binding ? `${label}, ${binding}` : label}
    aria-pressed={selected || undefined}
    className={[
      kind === 'macro' && 'theme-macro',
      selected && 'active',
      tone === 'danger' && 'theme-danger',
      unavailable && 'unavailable',
      className
    ].filter(Boolean).join(' ')}
    disabled={disabled}
    label={label}
    meta={binding}
    note={interaction}
    {...props}
  />
}

function telemetryState(runtime: RuntimeState | undefined, key: string | null): boolean {
  if (!key || !runtime?.gameStatus) return false
  return (runtime.gameStatus.flags as unknown as Record<string, boolean>)[key] === true
}
