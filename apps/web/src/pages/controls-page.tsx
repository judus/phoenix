import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  GameActionAvailability,
  GameActionDefinition,
  GameActionOperation,
  GameActionCatalogResponse,
  CommandExecutionResult,
  CommandTarget,
  ControlGridLayout,
  HealthResponse,
  MacroDefinition,
  MacroLibrary,
  MacroPlayback,
  MacroRecording,
  PhoenixModules,
  RuntimeState
} from '@phoenix/contracts'
import { commandTargetKey } from '@phoenix/contracts'
import type { PhoenixApi } from '../api/phoenix-api-client.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import { Page } from '../components/layout/page.js'
import type { NavigationItem } from '../components/navigation/navigation.js'
import { createCopilotId } from '../features/copilot/copilot-client-identity.js'

export type ControlCategory = GameActionDefinition['category'] | 'macros'

let fallbackMacroClientId: string | undefined

const CATEGORY_METADATA: Array<{
  id: ControlCategory
  icon: string
  label: string
}> = [
  { id: 'ship', icon: 'SHP', label: 'Ship' },
  { id: 'combat', icon: 'CBT', label: 'Combat' },
  { id: 'navigation', icon: 'NAV', label: 'Navigation' },
  { id: 'vessel', icon: 'VSL', label: 'Vessel' },
  { id: 'srv', icon: 'SRV', label: 'SRV' },
  { id: 'on_foot', icon: 'OFT', label: 'On Foot' },
  { id: 'radio', icon: 'RAD', label: 'Radio' },
  { id: 'emote', icon: 'EMO', label: 'Emotes' },
  { id: 'misc', icon: 'MSC', label: 'Miscellaneous' },
  { id: 'macros', icon: 'MAC', label: 'Macros' }
]

const controlsNavigation: NavigationItem[] = CATEGORY_METADATA.map(category => ({
  href: `#/controls/${category.id}`,
  icon: category.icon,
  id: category.id,
  label: category.label
}))

const editIcon = (
  <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
    <path d="M4 20h4L19 9l-4-4L4 16v4Zm10-14 4 4" />
  </svg>
)

export interface ControlsPageProps {
  api: PhoenixApi
  actionCatalog?: GameActionCatalogResponse
  category: ControlCategory
  controlLayout?: ControlGridLayout
  error?: string
  health?: HealthResponse
  onExecuteCommand: (target: CommandTarget, operation: GameActionOperation) => Promise<CommandExecutionResult>
  onSaveLayout: (layout: ControlGridLayout) => Promise<ControlGridLayout>
  runtimeState?: RuntimeState
}

export function ControlsPage ({
  api,
  actionCatalog,
  category,
  controlLayout,
  error,
  health,
  onExecuteCommand,
  onSaveLayout,
  runtimeState
}: ControlsPageProps) {
  const [editMode, setEditMode] = useState(false)
  const [draftLayout, setDraftLayout] = useState(controlLayout)
  const [editingPosition, setEditingPosition] = useState<number>()
  const [pickerFilter, setPickerFilter] = useState('')
  const [localError, setLocalError] = useState<string>()
  const [pendingConfirmation, setPendingConfirmation] = useState<GameActionAvailability>()
  const [pendingActions, setPendingActions] = useState<ReadonlySet<string>>(new Set())
  const [macroLibrary, setMacroLibrary] = useState<MacroLibrary>({ version: 1, macros: [] })
  const [moduleSettings, setModuleSettings] = useState<PhoenixModules>()
  const [recording, setRecording] = useState<MacroRecording>()
  const [recordingDraft, setRecordingDraft] = useState<MacroRecording>()
  const [playback, setPlayback] = useState<MacroPlayback>()
  const clientId = useRef(browserClientId())
  const heldActions = useRef(new Set<string>())
  const actionQueues = useRef(new Map<string, Promise<void>>())
  const executeCommand = useRef(onExecuteCommand)
  executeCommand.current = onExecuteCommand

  const activeLayout = draftLayout ?? controlLayout
  const page = activeLayout?.pages.find(candidate => candidate.category === category)
  const gridItems = useMemo(() => createGridItems(
    actionCatalog?.actions ?? [],
    macroLibrary.macros,
    page
  ), [actionCatalog, macroLibrary, page])

  useEffect(() => {
    void Promise.all([api.getMacros(), api.getModuleSettings()])
      .then(([library, modules]) => {
        setMacroLibrary(library)
        setModuleSettings(modules)
      })
      .catch(cause => setLocalError(cause instanceof Error ? cause.message : 'Macro module unavailable.'))
  }, [api])

  const cancelEditing = (): void => {
    setDraftLayout(controlLayout)
    setEditingPosition(undefined)
    setEditMode(false)
  }

  const secondaryNavigation: NavigationItem[] = [
    ...controlsNavigation,
    {
      id: 'edit',
      icon: editIcon,
      label: editMode ? 'Cancel layout editing' : 'Edit layout',
      disabled: !controlLayout || category === 'macros',
      onActivate: () => editMode ? cancelEditing() : setEditMode(true)
    }
  ]

  useEffect(() => {
    if (!editMode) setDraftLayout(controlLayout)
  }, [controlLayout, editMode])

  useEffect(() => {
    setPendingConfirmation(undefined)
    setEditingPosition(undefined)
    setEditMode(false)
  }, [category])

  useEffect(() => () => {
    for (const actionId of heldActions.current) queueAction(actionId, 'release')
    heldActions.current.clear()
  }, [])

  const queueTarget = (target: CommandTarget, operation: GameActionOperation): void => {
    const key = commandTargetKey(target)
    const previous = actionQueues.current.get(key) ?? Promise.resolve()
    const next = previous
      .catch(() => {})
      .then(async () => {
        setPendingActions(current => new Set(current).add(key))
        try {
          if (recording && target.type === 'game-action') {
            const updated = await api.recordMacroAction(recording.id, clientId.current, target.actionId, operation)
            setRecording(updated)
          } else {
            await executeCommand.current(target, operation)
          }
          setLocalError(undefined)
        } catch (cause) {
          setLocalError(cause instanceof Error ? cause.message : 'Control execution failed.')
        } finally {
          setPendingActions(current => {
            const remaining = new Set(current)
            remaining.delete(key)
            return remaining
          })
        }
      })
    actionQueues.current.set(key, next)
    void next.finally(() => {
      if (actionQueues.current.get(key) === next) actionQueues.current.delete(key)
    })
  }

  const queueAction = (actionId: string, operation: GameActionOperation): void => {
    queueTarget({ type: 'game-action', actionId }, operation)
  }

  const tap = (action: GameActionAvailability): void => {
    if (!action.available) return
    if (action.definition.risk === 'dangerous') {
      setPendingConfirmation(action)
      return
    }
    queueAction(action.definition.id, 'tap')
  }

  const press = (action: GameActionAvailability, pointerId: number, target: HTMLButtonElement): void => {
    if (!action.available || action.definition.inputMode !== 'hold') return
    target.setPointerCapture?.(pointerId)
    if (heldActions.current.has(action.definition.id)) return
    heldActions.current.add(action.definition.id)
    queueAction(action.definition.id, 'press')
  }

  const release = (action: GameActionAvailability): void => {
    if (!heldActions.current.delete(action.definition.id)) return
    queueAction(action.definition.id, 'release')
  }

  const categoryLabel = CATEGORY_METADATA.find(item => item.id === category)?.label ?? category
  const backend = actionCatalog?.backend

  const assignTarget = (commandTarget: CommandTarget): void => {
    if (!draftLayout || editingPosition === undefined) return
    const assignmentKey = commandTargetKey(commandTarget)
    setDraftLayout({
      ...draftLayout,
      pages: draftLayout.pages.map(page => {
        if (page.category !== category) return page
        const cells = page.cells.map(cell => (
          cell.target && commandTargetKey(cell.target) === assignmentKey
            ? { ...cell, target: null }
            : cell
        ))
        const target = cells.find(cell => cell.position === editingPosition)
        return {
          ...page,
          cells: (target
            ? cells.map(cell => cell.position === editingPosition
              ? { ...cell, target: commandTarget }
              : cell)
            : [...cells, { position: editingPosition, span: 1, target: commandTarget }]
          ).sort((left, right) => left.position - right.position)
        }
      })
    })
    setEditingPosition(undefined)
    setPickerFilter('')
  }

  const assignAction = (actionId: string): void => assignTarget({ type: 'game-action', actionId })

  const clearPosition = (): void => {
    if (!draftLayout || editingPosition === undefined) return
    setDraftLayout({
      ...draftLayout,
      pages: draftLayout.pages.map(page => page.category !== category
        ? page
        : {
            ...page,
            cells: page.cells.map(cell => cell.position === editingPosition
              ? { ...cell, target: null }
              : cell)
          })
    })
    setEditingPosition(undefined)
    setPickerFilter('')
  }

  const saveLayout = async (): Promise<void> => {
    if (!draftLayout) return
    try {
      const saved = await onSaveLayout(draftLayout)
      setDraftLayout(saved)
      setEditMode(false)
      setLocalError(undefined)
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Unable to save control layout.')
    }
  }

  const enableMacros = async (): Promise<void> => {
    if (!moduleSettings) return
    try {
      const saved = await api.saveModuleSettings({
        ...moduleSettings,
        macros: { ...moduleSettings.macros, enabled: true }
      })
      setModuleSettings(saved)
      setLocalError(undefined)
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Unable to enable macro module.')
    }
  }

  const startRecording = async (): Promise<void> => {
    try {
      setRecording(await api.startMacroRecording(clientId.current))
      setRecordingDraft(undefined)
      setLocalError(undefined)
      window.location.hash = '#/controls/ship'
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Unable to start recording.')
    }
  }

  const stopRecording = async (): Promise<void> => {
    if (!recording) return
    try {
      setRecordingDraft(await api.stopMacroRecording(recording.id, clientId.current))
      setRecording(undefined)
      window.location.hash = '#/controls/macros'
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Unable to stop recording.')
    }
  }

  const cancelRecording = async (): Promise<void> => {
    if (!recording) return
    try {
      await api.cancelMacroRecording(recording.id, clientId.current)
      setRecording(undefined)
      setRecordingDraft(undefined)
      window.location.hash = '#/controls/macros'
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Unable to cancel recording.')
    }
  }

  const saveRecording = async (name: string): Promise<void> => {
    if (!recordingDraft) return
    try {
      await api.saveMacro(recordingDefinition(name, recordingDraft))
      setMacroLibrary(await api.getMacros())
      setRecordingDraft(undefined)
      setLocalError(undefined)
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Unable to save macro.')
    }
  }

  const playMacro = async (macro: MacroDefinition): Promise<void> => {
    try {
      setPlayback({
        completedSteps: 0,
        macroId: macro.id,
        message: 'Starting macro playback.',
        runId: createCopilotId(),
        startedAt: new Date().toISOString(),
        status: 'running',
        totalSteps: macro.steps.length
      })
      setPlayback(await api.playMacro(macro.id))
      setLocalError(undefined)
    } catch (cause) {
      setLocalError(cause instanceof Error ? cause.message : 'Macro playback failed.')
      setPlayback(undefined)
    }
  }

  if (category === 'macros') {
    return (
      <PhoenixShell
        activePrimaryItemId="controls"
        activeSecondaryItemId="macros"
        error={error ?? localError}
        health={health}
        secondaryNavigation={secondaryNavigation}
      >
        <Page className="controls-page controls-page--macros">
          <div className="controls-page__content">
            <MacroWorkbench
              draft={recordingDraft}
              enabled={moduleSettings?.macros.enabled === true}
              library={macroLibrary}
              playback={playback}
              onAbort={async () => { setPlayback(await api.abortMacroPlayback() ?? undefined) }}
              onDelete={async id => {
                await api.deleteMacro(id)
                setMacroLibrary(await api.getMacros())
              }}
              onDraftChange={setRecordingDraft}
              onEnable={() => void enableMacros()}
              onPlay={macro => void playMacro(macro)}
              onSave={name => void saveRecording(name)}
              onStart={() => void startRecording()}
            />
          </div>
        </Page>
      </PhoenixShell>
    )
  }

  return (
    <PhoenixShell
      activePrimaryItemId="controls"
      activeSecondaryItemId={editMode ? 'edit' : category}
      error={error ?? localError}
      health={health}
      secondaryNavigation={secondaryNavigation}
    >
      <Page className={`controls-page${editMode ? ' controls-page--editing' : ''}`}>
        <div className="controls-page__content">
          {recording && (
            <section className="macro-recording-bar" aria-live="polite">
              <strong>Recording macro</strong>
              <span>{recording.entries.length} commands captured</span>
              <button type="button" onClick={() => void cancelRecording()}>Cancel</button>
              <button type="button" onClick={() => void stopRecording()}>Stop and review</button>
            </section>
          )}
          {editMode && (
          <section className="control-toolbar" aria-label="Control layout status">
            <p>
              <strong>{categoryLabel}</strong> ·{' '}
              <strong>{page?.cells.filter(cell => cell.target).length ?? 0}</strong> assigned ·{' '}
              <span>{actionCatalog?.actions.length ?? 0} available commands</span> ·{' '}
              <span>{backend?.id ?? 'backend pending'}</span> ·{' '}
              <span>{backend?.available ? 'live' : 'unavailable'}</span>
            </p>
            <div className="control-toolbar__actions">
              {editMode
                ? (
                    <>
                      <button type="button" onClick={cancelEditing}>Cancel</button>
                      <button type="button" onClick={() => void saveLayout()}>Save layout</button>
                    </>
                  )
                : null}
            </div>
          </section>
          )}

          <section
            className="control-grid"
            aria-label={`${categoryLabel} command grid`}
            style={{
              gridTemplateColumns: `repeat(${page?.columns ?? 8}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${page?.rows ?? 5}, minmax(0, 1fr))`
            }}
          >
            {gridItems.map(item => {
              const { action, macro, position, span } = item
              if (macro) {
                const target = { type: 'macro' as const, macroId: macro.id }
                const pending = pendingActions.has(commandTargetKey(target))
                return (
                  <button
                    key={`macro:${macro.id}`}
                    type="button"
                    className="control-grid__button control-grid__button--macro"
                    disabled={!editMode && !macro.enabled}
                    style={{ gridColumn: `span ${span}` }}
                    onClick={() => {
                      if (editMode) {
                        setEditingPosition(position)
                        setPickerFilter('')
                      } else {
                        queueTarget(target, 'tap')
                      }
                    }}
                  >
                    <span className="control-grid__label">{macro.name}</span>
                    <span className="control-grid__binding">MACRO</span>
                    <span className="control-grid__meta">{pending ? 'running' : macro.risk}</span>
                  </button>
                )
              }
              if (!action) {
                return (
                  <button
                    key={position}
                    type="button"
                    className="control-grid__empty"
                    disabled={!editMode}
                    style={{ gridColumn: `span ${span}` }}
                    onClick={() => {
                      setEditingPosition(position)
                      setPickerFilter('')
                    }}
                  >
                    <span>{position}</span>
                    {item.target && <small>Missing: {commandTargetLabel(item.target)}</small>}
                  </button>
                )
              }
              const { definition } = action
              const pending = pendingActions.has(commandTargetKey({ type: 'game-action', actionId: definition.id }))
              const stateActive = telemetryState(runtimeState, definition.telemetryKey)
              return (
                <button
                  key={definition.id}
                  type="button"
                  className={`control-grid__button${stateActive ? ' control-grid__button--active' : ''}${definition.risk === 'dangerous' ? ' control-grid__button--dangerous' : ''}`}
                  disabled={!editMode && !action.available}
                  aria-pressed={definition.telemetryKey ? stateActive : undefined}
                  style={{ gridColumn: `span ${span}` }}
                  onPointerDown={event => {
                    if (editMode) return
                    if (definition.inputMode === 'hold') {
                      event.preventDefault()
                      press(action, event.pointerId, event.currentTarget)
                    }
                  }}
                  onPointerUp={() => !editMode && release(action)}
                  onPointerCancel={() => !editMode && release(action)}
                  onClick={event => {
                    if (editMode) {
                      setEditingPosition(position)
                      setPickerFilter('')
                      return
                    }
                    if (definition.inputMode === 'hold') {
                      if (event.detail === 0) {
                        queueAction(definition.id, 'press')
                        queueAction(definition.id, 'release')
                      }
                      return
                    }
                    tap(action)
                  }}
                  title={action.unavailableReason ?? definition.description}
                >
                  <span className="control-grid__label">{definition.label}</span>
                  <span className="control-grid__binding">{action.binding?.display ?? 'Unbound'}</span>
                  <span className="control-grid__meta">
                    {editMode ? `cell ${position} · select to replace` : definition.inputMode}
                    {pending ? ' · sending' : ''}
                  </span>
                </button>
              )
            })}
          </section>

          {editingPosition !== undefined && (
            <section className="control-picker" role="dialog" aria-modal="true">
              <header>
                <div>
                  <strong>Assign command</strong>
                  <p>{categoryLabel} cell {editingPosition}</p>
                </div>
                <button type="button" onClick={() => setEditingPosition(undefined)}>Close</button>
              </header>
              <input
                autoFocus
                type="search"
                value={pickerFilter}
                onChange={event => setPickerFilter(event.target.value)}
                placeholder="Filter commands"
              />
              <button type="button" onClick={clearPosition}>Clear explicit assignment</button>
              <div className="control-picker__list">
                {macroLibrary.macros
                  .filter(macro => macro.name.toLowerCase().includes(pickerFilter.trim().toLowerCase()))
                  .map(macro => (
                    <button
                      type="button"
                      key={`macro:${macro.id}`}
                      onClick={() => assignTarget({ type: 'macro', macroId: macro.id })}
                    >
                      <span>{macro.name}</span>
                      <small>MACRO · {macro.steps.length} steps · {macro.risk}</small>
                    </button>
                  ))}
                {(actionCatalog?.actions ?? [])
                  .filter(action => [
                    action.definition.label,
                    action.definition.eliteBinding,
                    action.definition.category,
                    action.binding?.display
                  ].some(value => value?.toLowerCase().includes(pickerFilter.trim().toLowerCase())))
                  .sort(actionComparator)
                  .map(action => (
                    <button
                      type="button"
                      key={action.definition.id}
                      onClick={() => assignAction(action.definition.id)}
                    >
                      <span>{action.definition.label}</span>
                      <small>{action.definition.eliteBinding} · {action.binding?.display ?? 'Unbound'}</small>
                    </button>
                  ))}
              </div>
            </section>
          )}

          {pendingConfirmation && (
            <section className="control-confirmation" role="alertdialog" aria-modal="true">
              <div>
                <strong>Confirm {pendingConfirmation.definition.label}</strong>
                <p>This immediately sends {pendingConfirmation.binding?.display} to Elite Dangerous.</p>
              </div>
              <div>
                <button type="button" onClick={() => setPendingConfirmation(undefined)}>Cancel</button>
                <button
                  type="button"
                  className="control-confirmation__confirm"
                  onClick={() => {
                    queueAction(pendingConfirmation.definition.id, 'tap')
                    setPendingConfirmation(undefined)
                  }}
                >Confirm</button>
              </div>
            </section>
          )}

        </div>
      </Page>
    </PhoenixShell>
  )
}

function MacroWorkbench ({
  draft,
  enabled,
  library,
  playback,
  onAbort,
  onDelete,
  onDraftChange,
  onEnable,
  onPlay,
  onSave,
  onStart
}: {
  draft?: MacroRecording
  enabled: boolean
  library: MacroLibrary
  playback?: MacroPlayback
  onAbort: () => Promise<void>
  onDelete: (id: string) => Promise<void>
  onDraftChange: (draft: MacroRecording) => void
  onEnable: () => void
  onPlay: (macro: MacroDefinition) => void
  onSave: (name: string) => void
  onStart: () => void
}) {
  const [name, setName] = useState('')
  return (
    <section className="macro-workbench">
      <header className="macro-workbench__header">
        <div>
          <span>Contextual command sequences</span>
          <h1>Macros</h1>
          <p>Record semantic PHOENIX controls while watching Elite respond. Sequence completion never proves the game outcome.</p>
        </div>
        {enabled
          ? <button type="button" onClick={onStart}>Start recording</button>
          : <button type="button" onClick={onEnable}>Enable macro module</button>}
      </header>

      {draft && (
        <section className="macro-draft">
          <header>
            <div><span>Recorded draft</span><strong>{draft.entries.length} commands</strong></div>
            <div className="macro-draft__save">
              <button
                type="button"
                onClick={() => onDraftChange({
                  ...draft,
                  entries: draft.entries.map(entry => ({ ...entry, delayBeforeMs: 0 }))
                })}
              >
                Remove pauses
              </button>
              <input value={name} placeholder="Macro name" onChange={event => setName(event.target.value)} />
              <button
                type="button"
                disabled={!name.trim() || !draft.entries.some(entry => successfulRecording(entry.status))}
                onClick={() => onSave(name.trim())}
              >
                Save macro
              </button>
            </div>
          </header>
          <ol>
            {draft.entries.map((entry, index) => (
              <li key={`${entry.actionId}:${index}`} className={!successfulRecording(entry.status) ? 'is-failed' : undefined}>
                <span>{index + 1}</span>
                <strong>{entry.actionId.replace(/^elite\./u, '')}</strong>
                <small>{entry.operation} · {entry.status}</small>
                {index > 0 && (
                  <label>
                    <span>Wait after previous</span>
                    <input
                      type="number"
                      min="0"
                      max="30000"
                      step="50"
                      value={entry.delayBeforeMs}
                      onChange={event => {
                        const delayBeforeMs = Math.max(0, Math.min(30_000, Number(event.target.value) || 0))
                        onDraftChange({
                          ...draft,
                          entries: draft.entries.map((candidate, candidateIndex) => candidateIndex === index
                            ? { ...candidate, delayBeforeMs }
                            : candidate)
                        })
                      }}
                    />
                    <span>ms</span>
                  </label>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {playback && (
        <section className="macro-playback" aria-live="polite">
          <div>
            <strong>{playback.status === 'running' ? 'Macro running' : `Macro ${playback.status}`}</strong>
            <span>{playback.completedSteps} / {playback.totalSteps} steps · {playback.message}</span>
          </div>
          {playback.status === 'running' && <button type="button" onClick={() => void onAbort()}>Abort</button>}
        </section>
      )}

      <div className="macro-library">
        {library.macros.length === 0
          ? <p className="macro-library__empty">No macros saved. Start a recording, switch to a control page, and operate the game from PHOENIX.</p>
          : library.macros.map(macro => (
            <article key={macro.id} className="macro-card">
              <header><span>MACRO</span><small>{macro.risk}</small></header>
              <h2>{macro.name}</h2>
              <p>{macro.description || `${macro.steps.length} semantic steps`}</p>
              <footer>
                <span>{macro.steps.length} steps</span>
                <button type="button" disabled={!enabled || playback?.status === 'running'} onClick={() => onPlay(macro)}>Run</button>
                <button type="button" onClick={() => void onDelete(macro.id)}>Delete</button>
              </footer>
            </article>
          ))}
      </div>
    </section>
  )
}

function recordingDefinition (name: string, recording: MacroRecording): MacroDefinition {
  const successful = recording.entries.filter(entry => successfulRecording(entry.status))
  const steps: MacroDefinition['steps'] = []
  successful.forEach((entry, index) => {
    if (index > 0 && entry.delayBeforeMs > 0) {
      steps.push({ type: 'wait', durationMs: Math.min(entry.delayBeforeMs, 30_000) })
    }
    steps.push({ type: 'game-action', actionId: entry.actionId, operation: entry.operation })
  })
  return {
    assumptions: [],
    description: '',
    enabled: true,
    id: macroId(name),
    name,
    risk: 'safe',
    steps,
    version: 1
  }
}

function successfulRecording (status: MacroRecording['entries'][number]['status']): boolean {
  return ['accepted', 'confirmed', 'unconfirmed', 'already_satisfied'].includes(status)
}

function macroId (name: string): string {
  const normalized = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')
  return /^[a-z]/u.test(normalized) ? normalized : `macro-${normalized || createCopilotId().slice(-8)}`
}

function browserClientId (): string {
  if (fallbackMacroClientId) return fallbackMacroClientId
  if (typeof window === 'undefined') return 'server-render'
  const key = 'phoenix.macro.client-id'
  try {
    const existing = window.localStorage.getItem(key)
    if (existing) return (fallbackMacroClientId = existing)
    const created = createCopilotId()
    window.localStorage.setItem(key, created)
    return (fallbackMacroClientId = created)
  } catch {
    return (fallbackMacroClientId = createCopilotId())
  }
}

function actionComparator (left: GameActionAvailability, right: GameActionAvailability): number {
  if (left.available !== right.available) return left.available ? -1 : 1
  return left.definition.label.localeCompare(right.definition.label)
}

interface ControlGridItem {
  action?: GameActionAvailability
  macro?: MacroDefinition
  target: CommandTarget | null
  position: number
  span: number
}

function createGridItems (
  actions: GameActionAvailability[],
  macros: MacroDefinition[],
  page: ControlGridLayout['pages'][number] | undefined
): ControlGridItem[] {
  const actionsById = new Map(actions.map(action => [action.definition.id, action]))
  const macrosById = new Map(macros.map(macro => [macro.id, macro]))
  const cells = new Map(page?.cells.map(cell => [cell.position, cell]) ?? [])
  const covered = new Set<number>()
  for (const cell of page?.cells ?? []) {
    for (let offset = 1; offset < cell.span; offset++) covered.add(cell.position + offset)
  }

  const items: ControlGridItem[] = []
  const capacity = (page?.columns ?? 8) * (page?.rows ?? 5)
  for (let position = 1; position <= capacity; position++) {
    if (covered.has(position)) continue
    const cell = cells.get(position)
    const target = cell?.target ?? null
    const actionId = target?.type === 'game-action' ? target.actionId : null
    items.push({
      position,
      span: cell?.span ?? 1,
      target,
      action: actionId ? actionsById.get(actionId) : undefined,
      macro: target?.type === 'macro' ? macrosById.get(target.macroId) : undefined
    })
  }
  return items
}

function commandTargetLabel (target: CommandTarget): string {
  switch (target.type) {
    case 'game-action': return target.actionId
    case 'navigation': return target.destinationId
    case 'macro': return target.macroId
  }
}

function telemetryState (runtimeState: RuntimeState | undefined, key: string | null): boolean {
  if (!key || !runtimeState?.gameStatus) return false
  const flags = runtimeState.gameStatus.flags as unknown as Record<string, boolean>
  return flags[key] === true
}
