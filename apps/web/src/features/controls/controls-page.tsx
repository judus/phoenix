import { useEffect, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes, type CSSProperties } from 'react'
import {
  applyControlDeckLayoutPreset,
  moveControlDeckGridElement,
  removeControlDeckElement,
  replaceControlDeck,
  replaceControlDeckGroup,
  resolveControlDeckInteraction,
  upsertControlDeckElement,
  useCustomControlDeckLayout,
  type ControlDeckElementAppearance,
  type ControlDeckGridDeck,
  type ControlDeckLayoutPreset,
  type ControlDeckDeckGroup
} from 'control-deck/core'
import { PHOENIX_CONTROL_LAYOUT_PRESETS, PhoenixControlDeckThemeSchema, controlDeckTargetToPhoenixTarget, phoenixControlLayoutPreset, type CommandTarget, type GameActionAvailability, type GameActionOperation, type PhoenixControlDeckConfiguration, type PhoenixControlDeckTheme, type RuntimeState } from '@phoenix/contracts'
import { Breadcrumbs, Button, CheckIcon, compactBindingLabel, ControlContext, CrossIcon, DataTable, IconButton, Inline, Loading, NumberInput, PageFrame, PageHeader, Select, Status, TileButton, Widget } from '@phoenix/ui'
import { createClientId } from '../../application/identity/client-identity.js'
import type { MacroRuntime } from '../../application/macros/macro-runtime.js'
import type { ControlDeckId } from '../../application/navigation/phoenix-route.js'
import { gameActionCategoryLabel } from './controls-navigation.js'
import type { ControlsControllerSnapshot } from './use-controls-controller.js'
import { HoldGestureController } from './hold-gesture-controller.js'
import { ArmingController } from './arming-controller.js'
import { ButtonEditor } from './button-editor.js'
import { ControlSurface } from './control-surface.js'

export function ControlsPage({ deckId, controller, editing, macros, runtime, variableFontSizes, onEditingChange, onExecuteAction, onExecuteNavigation, onSaveConfiguration }: {
  deckId: ControlDeckId
  controller: ControlsControllerSnapshot
  editing: boolean
  macros: MacroRuntime
  runtime?: RuntimeState
  variableFontSizes: boolean
  onEditingChange(editing: boolean): void
  onExecuteAction(actionId: string, operation: GameActionOperation, leaseId?: string): Promise<unknown>
  onExecuteNavigation?(target: Extract<CommandTarget, { type: 'navigation' }>): Promise<void>
  onSaveConfiguration(configuration: PhoenixControlDeckConfiguration): Promise<PhoenixControlDeckConfiguration>
}) {
  const [error, setError] = useState<string>()
  const [draft, setDraft] = useState<PhoenixControlDeckConfiguration | undefined>(controller.configuration)
  const [editingPosition, setEditingPosition] = useState<number>()
  const [saving, setSaving] = useState(false)
  const held = useRef(new HoldGestureController())
  const arming = useRef(new ArmingController()).current
  const armingTimers = useRef(new Map<number, ReturnType<typeof globalThis.setTimeout>>())
  const suppressClicks = useRef(new Set<string>())
  const armedElementId = useSyncExternalStore(arming.subscribe, arming.getSnapshot, arming.getSnapshot)
  useEffect(() => { if (!editing) setDraft(controller.configuration) }, [controller.configuration, editing])
  useEffect(() => { setEditingPosition(undefined); arming.cancel() }, [deckId])
  useEffect(() => {
    if (editing) arming.cancel()
  }, [arming, editing])
  useEffect(() => () => {
    void held.current.releaseAll()
    for (const timer of armingTimers.current.values()) globalThis.clearTimeout(timer)
    armingTimers.current.clear()
    arming.cancel()
  }, [arming, deckId])
  const activeConfiguration = draft ?? controller.configuration
  const deck = activeConfiguration?.decks.find(candidate => candidate.id === deckId)
  const group = deck?.groupId ? activeConfiguration?.groups?.find(candidate => candidate.id === deck.groupId) : undefined
  const deckLabel = group?.name ?? deck?.name ?? deckId
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
        onSave={() => {
          if (!draft) return
          setSaving(true)
          void onSaveConfiguration(draft).then(saved => { setDraft(saved); onEditingChange(false); setError(undefined) }).catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to save Control Deck configuration.')).finally(() => setSaving(false))
        }}
        saving={saving}
        onCancel={() => { setDraft(controller.configuration); onEditingChange(false); setError(undefined) }}
      />}
      {editing && editingPosition !== undefined && editorColumn !== undefined && editorRow !== undefined && <PageHeader
        context={<Breadcrumbs items={[{ label: 'Controls' }, { label: deckLabel }]} />}
        title={`Button Slot ${editorColumn}:${editorRow}`}
        variant="cockpit"
      />}
      {controller.status === 'error' || error || macros.error
        ? <Status tone="danger">{error ?? macros.error ?? controller.error}</Status>
        : controller.status === 'loading'
          ? <Loading>Loading command grid…</Loading>
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
              aria-label={`${deckLabel} command grid`}
              className="controls controls-command control-deck"
              deck={deck}
              onMove={editing ? (elementId, column, row) => setDraft(replaceControlDeck(activeConfiguration, moveControlDeckGridElement(deck, elementId, { column, row }))) : undefined}
              renderEmpty={({ column, row }) => {
                const position = (row - 1) * deck.layout.columns + column
                return editing
                  ? <Button aria-label={`Cell ${position}`} className="control-deck-empty" variant="quiet" onClick={() => setEditingPosition(position)}>{position}</Button>
                  : <div className="control-deck-empty" />
              }}
              renderCommand={element => {
                const position = (element.placement.row - 1) * deck.layout.columns + element.placement.column
                const target = controlDeckTargetToPhoenixTarget(element.target)
                if (target.type === 'navigation') {
                  const command = controller.commands?.adapters.flatMap(adapter => adapter.commands)
                    .find(command => command.id === element.target.commandId)
                  const elementId = element.id
                  const confirmation = element.interaction.confirmation
                  const armed = armedElementId === elementId
                  return <ControlDeckCommandTile
                    appearance={element.appearance}
                    data-deskplane-swipe-through={!editing && confirmation.kind === 'none' ? '' : undefined}
                    binding={target.destinationId.startsWith('saved-query:') ? 'Run query' : 'Open'}
                    label={element.appearance.label ?? command?.label ?? target.destinationId}
                    interaction={armed || confirmation.kind !== 'arm-then-tap' ? 'tap' : 'arm'}
                    selected={armed}
                    unavailable={!command?.available || !onExecuteNavigation}
                    disabled={!editing && (!command?.available || !onExecuteNavigation)}
                    variableFontSizes={variableFontSizes}
                    onClick={() => {
                      if (editing) { setEditingPosition(position); return }
                      if (!command?.available || !onExecuteNavigation) return
                      if (confirmation.kind === 'arm-then-tap') {
                        if (!confirmSafety(elementId)) return
                      } else arming.cancel()
                      void onExecuteNavigation(target).then(() => setError(undefined))
                        .catch(cause => setError(cause instanceof Error ? cause.message : 'Unable to open shortcut.'))
                    }}
                    onContextMenu={event => event.preventDefault()}
                    onPointerDown={event => {
                      if (editing) return
                      event.currentTarget.setPointerCapture?.(event.pointerId)
                      if (confirmation.kind === 'arm-then-tap') beginSafetyHold(elementId, confirmation.armedForMs, event.pointerId)
                      else arming.cancel()
                    }}
                    onPointerUp={event => finishSafetyHold(elementId, event.pointerId)}
                    onPointerCancel={event => finishSafetyHold(elementId, event.pointerId)}
                  />
                }
                if (target.type === 'macro') {
                  const macro = macros.library.macros.find(candidate => candidate.id === target.macroId)
                  const elementId = element.id
                  const confirmation = element.interaction.confirmation
                  const armed = armedElementId === elementId
                  const interaction = resolveControlDeckInteraction(element.interaction, 'tap')
                  return <ControlDeckCommandTile
                    appearance={element.appearance}
                    data-deskplane-swipe-through={!editing && confirmation.kind === 'none' ? '' : undefined}
                    binding="Macro"
                    label={element.appearance.label ?? macro?.name ?? target.macroId}
                    interaction={armed ? 'tap' : interaction.interactionHint}
                    kind="macro"
                    selected={armed}
                    unavailable={!editing && !macro?.enabled}
                    variableFontSizes={variableFontSizes}
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
                if (target.type !== 'game-action') return <MissingTarget appearance={element.appearance} target={target} variableFontSizes={variableFontSizes} />
                const action = actions.get(target.actionId)
                if (!action) return <MissingTarget appearance={element.appearance} target={target} variableFontSizes={variableFontSizes} />
                const active = telemetryState(runtime, action.definition.telemetryKey)
                const elementId = element.id
                const confirmation = element.interaction.confirmation
                const armed = armedElementId === elementId
                const interaction = resolveControlDeckInteraction(element.interaction, action.definition.inputMode)
                return <ControlDeckCommandTile
                  appearance={element.appearance}
                  data-deskplane-swipe-through={!editing && action.definition.inputMode !== 'hold' && confirmation.kind === 'none' ? '' : undefined}
                  binding={action.binding?.display ?? 'Unbound'}
                  label={element.appearance.label ?? action.definition.label}
                  interaction={armed ? 'tap' : interaction.interactionHint}
                  selected={armed || active}
                  unavailable={!action.available}
                  variableFontSizes={variableFontSizes}
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

function DeckSettings ({ configuration, deck, group, onChange, onSave, onCancel, saving }: {
  configuration: PhoenixControlDeckConfiguration
  deck: ControlDeckGridDeck
  group: ControlDeckDeckGroup
  onChange(configuration: PhoenixControlDeckConfiguration): void
  onSave(): void
  onCancel(): void
  saving: boolean
}) {
  const [columns, setColumns] = useState(String(deck.layout.columns))
  const [rows, setRows] = useState(String(deck.layout.rows))
  const [error, setError] = useState<string>()
  useEffect(() => setColumns(String(deck.layout.columns)), [deck.layout.columns])
  useEffect(() => setRows(String(deck.layout.rows)), [deck.layout.rows])
  const locked = Boolean(deck.layoutPresetId)
  const presets = PHOENIX_CONTROL_LAYOUT_PRESETS
  const changeSize = (columns: number, rows: number) => {
    try {
      onChange(replaceControlDeck(configuration, resizeDeck(deck, columns, rows)))
      setError(undefined)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to resize deck.') }
  }
  return <section aria-label="Deck settings" className="control-deck-settings widget-command-row">
    <Widget aria-label="Deck layout settings" className="control-deck-settings-form">
      <ControlContext className="control-deck-settings-controls" density="compact">
        <Select aria-label="Deck layout" className="form-mini" value={deck.layoutPresetId ?? ''} onChange={event => {
          const preset = event.target.value === '' ? null : phoenixControlLayoutPreset(event.target.value)
          if (event.target.value !== '' && !preset) return
          try {
            onChange(replaceControlDeck(configuration, preset
              ? applyDeckPreset(deck, preset)
              : useCustomControlDeckLayout(deck)))
            setError(undefined)
          } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to change deck layout.') }
        }}>
          <option value="">Custom</option>
          {presets.map(preset => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
        </Select>
        <NumberInput aria-label="Deck columns" className="form-mini" disabled={locked} min={1} max={12} value={columns}
          onBlur={() => setColumns(String(deck.layout.columns))}
          onChange={event => {
            setColumns(event.target.value)
            const nextColumns = boundedInteger(event.target.value, 1, 12)
            if (nextColumns !== undefined) changeSize(nextColumns, deck.layout.rows)
          }} />
        <NumberInput aria-label="Deck rows" className="form-mini" disabled={locked} min={1} max={12} value={rows}
          onBlur={() => setRows(String(deck.layout.rows))}
          onChange={event => {
            setRows(event.target.value)
            const nextRows = boundedInteger(event.target.value, 1, 12)
            if (nextRows !== undefined) changeSize(deck.layout.columns, nextRows)
          }} />
        <Select aria-label="Deck theme" className="form-mini" value={controlDeckTheme(deck, group)} onChange={event => {
          const theme = PhoenixControlDeckThemeSchema.parse(event.target.value)
          onChange(applyControlDeckTheme(configuration, deck, group, theme))
        }}>
          {['phoenix', 'blue', 'cyan', 'green', 'amber', 'orange', 'red', 'violet', 'magenta'].map(theme => <option key={theme} value={theme}>{themeLabel(PhoenixControlDeckThemeSchema.parse(theme))}</option>)}
        </Select>
      </ControlContext>
      {error && <Status tone="danger">{error}</Status>}
    </Widget>
    <Inline gap="xs" wrap={false}>
      <IconButton className="btn-no-grip" variant="outline" label="Cancel editing" disabled={saving} onClick={onCancel}><CrossIcon /></IconButton>
      <IconButton
        aria-busy={saving || undefined}
        className="btn-no-grip"
        disabled={saving}
        label="Save and finish editing"
        variant="primary"
        onClick={onSave}
      >
        <CheckIcon />
      </IconButton>
    </Inline>
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
  const outside = deck.elements.filter(element => element.placement.row + element.placement.rowSpan - 1 > rows ||
    element.placement.column + element.placement.columnSpan - 1 > columns)
  if (outside.some(element => element.kind === 'command')) {
    throw new Error('Move or remove buttons outside the new grid before shrinking this deck.')
  }
  return {
    ...deck,
    layout: { kind: 'grid', columns, rows },
    elements: deck.elements.filter(element => !outside.includes(element))
  }
}

export function applyDeckPreset(deck: ControlDeckGridDeck, preset: ControlDeckLayoutPreset): ControlDeckGridDeck {
  const next = applyControlDeckLayoutPreset(deck, preset)
  const kept = new Set(next.elements.filter(element => element.kind === 'command').map(element => element.id))
  if (deck.elements.some(element => element.kind === 'command' && !kept.has(element.id))) {
    throw new Error('Move or remove buttons outside the preset slots before changing this layout.')
  }
  return next
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
  return deck?.appearance?.colorScheme ?? group?.appearance?.colorScheme ?? 'phoenix'
}

export function applyControlDeckTheme (
  configuration: PhoenixControlDeckConfiguration,
  deck: ControlDeckGridDeck,
  group: ControlDeckDeckGroup,
  theme: PhoenixControlDeckTheme
): PhoenixControlDeckConfiguration {
  const groupAppearance = withoutColorScheme(group.appearance)
  const deckAppearance = withoutColorScheme(deck.appearance)
  const normalizedGroup: ControlDeckDeckGroup = {
    ...group,
    appearance: groupAppearance
  }
  const themedDeck: ControlDeckGridDeck = {
    ...deck,
    appearance: theme === 'phoenix'
      ? deckAppearance
      : { ...deckAppearance, colorScheme: theme }
  }
  return replaceControlDeck(
    replaceControlDeckGroup(configuration, normalizedGroup),
    themedDeck
  ) as PhoenixControlDeckConfiguration
}

function withoutColorScheme (appearance: ControlDeckDeckGroup['appearance']): ControlDeckDeckGroup['appearance'] {
  if (!appearance) return undefined
  const { colorScheme: _colorScheme, ...rest } = appearance
  return Object.keys(rest).length > 0 ? rest : undefined
}

function MissingTarget({ appearance, target, variableFontSizes }: { appearance: ControlDeckElementAppearance, target: CommandTarget, variableFontSizes: boolean }) {
  const label = target.type === 'navigation' ? target.destinationId : target.type === 'macro' ? target.macroId : target.actionId
  return <ControlDeckCommandTile appearance={appearance} binding="Unbound" interaction="tap" label={label} unavailable variableFontSizes={variableFontSizes} />
}

function ControlDeckCommandTile({ appearance, binding, interaction, kind = 'action', label, selected = false, unavailable = false, variableFontSizes, disabled = unavailable, className, style, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  appearance: ControlDeckElementAppearance
  binding?: string
  interaction: 'tap' | 'hold' | 'arm'
  kind?: 'action' | 'macro'
  label: string
  selected?: boolean
  unavailable?: boolean
  variableFontSizes: boolean
}) {
  const displayedBinding = binding === undefined ? undefined : compactBindingLabel(binding)
  const dangerAppearance = appearance.foregroundColor === '#ff6258' && appearance.backgroundColor === '#3a1717'
  const customStyle = {
    ...(appearance.foregroundColor ? { '--command-border': dangerAppearance ? 'var(--command-danger-border)' : appearance.foregroundColor } : {}),
    ...(appearance.backgroundColor ? { '--command-background': dangerAppearance ? 'var(--command-danger-background)' : appearance.backgroundColor } : {}),
    ...style
  } as CSSProperties
  return <TileButton
    aria-label={binding ? `${label}, ${binding}` : label}
    aria-pressed={selected || undefined}
    className={[
      kind === 'macro' && 'theme-macro',
      selected && 'active',
      unavailable && 'unavailable',
      className
    ].filter(Boolean).join(' ')}
    disabled={disabled}
    label={label}
    meta={displayedBinding}
    metaTitle={binding}
    note={interaction}
    style={customStyle}
    variableFontSizes={variableFontSizes}
    {...props}
  />
}

function telemetryState(runtime: RuntimeState | undefined, key: string | null): boolean {
  if (!key || !runtime?.gameStatus) return false
  return (runtime.gameStatus.flags as unknown as Record<string, boolean>)[key] === true
}
