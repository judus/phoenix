import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  GameActionAvailability,
  GameActionDefinition,
  GameActionOperation,
  GameActionResult,
  GameActionCatalogResponse,
  ControlGridLayout,
  HealthResponse,
  RuntimeState
} from '@phoenix/contracts'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import { Page } from '../components/layout/page.js'
import type { NavigationItem } from '../components/navigation/navigation.js'

export type ControlCategory = GameActionDefinition['category']

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
  { id: 'misc', icon: 'MSC', label: 'Miscellaneous' }
]

const controlsNavigation: NavigationItem[] = CATEGORY_METADATA.map(category => ({
  href: `#/controls/${category.id}`,
  icon: category.icon,
  id: category.id,
  label: category.label
}))

export interface ControlsPageProps {
  actionCatalog?: GameActionCatalogResponse
  category: ControlCategory
  controlLayout?: ControlGridLayout
  error?: string
  health?: HealthResponse
  onExecuteAction: (actionId: string, operation: GameActionOperation) => Promise<GameActionResult>
  onSaveLayout: (layout: ControlGridLayout) => Promise<ControlGridLayout>
  runtimeState?: RuntimeState
}

export function ControlsPage ({
  actionCatalog,
  category,
  controlLayout,
  error,
  health,
  onExecuteAction,
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
  const heldActions = useRef(new Set<string>())
  const actionQueues = useRef(new Map<string, Promise<void>>())
  const executeAction = useRef(onExecuteAction)
  executeAction.current = onExecuteAction

  const activeLayout = draftLayout ?? controlLayout
  const page = activeLayout?.pages.find(candidate => candidate.category === category)
  const gridItems = useMemo(() => createGridItems(
    actionCatalog?.actions ?? [],
    page
  ), [actionCatalog, page])

  const cancelEditing = (): void => {
    setDraftLayout(controlLayout)
    setEditingPosition(undefined)
    setEditMode(false)
  }

  const secondaryNavigation: NavigationItem[] = [
    ...controlsNavigation,
    {
      id: 'edit',
      icon: 'EDT',
      label: editMode ? 'Cancel layout editing' : 'Edit layout',
      disabled: !controlLayout,
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

  const queueAction = (actionId: string, operation: GameActionOperation): void => {
    const previous = actionQueues.current.get(actionId) ?? Promise.resolve()
    const next = previous
      .catch(() => {})
      .then(async () => {
        setPendingActions(current => new Set(current).add(actionId))
        try {
          await executeAction.current(actionId, operation)
          setLocalError(undefined)
        } catch (cause) {
          setLocalError(cause instanceof Error ? cause.message : 'Control execution failed.')
        } finally {
          setPendingActions(current => {
            const remaining = new Set(current)
            remaining.delete(actionId)
            return remaining
          })
        }
      })
    actionQueues.current.set(actionId, next)
    void next.finally(() => {
      if (actionQueues.current.get(actionId) === next) actionQueues.current.delete(actionId)
    })
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

  const assignAction = (actionId: string): void => {
    if (!draftLayout || editingPosition === undefined) return
    setDraftLayout({
      ...draftLayout,
      pages: draftLayout.pages.map(page => {
        if (page.category !== category) return page
        const cells = page.cells.map(cell => (
          cell.actionId === actionId ? { ...cell, actionId: null } : cell
        ))
        const target = cells.find(cell => cell.position === editingPosition)
        return {
          ...page,
          cells: (target
            ? cells.map(cell => cell.position === editingPosition ? { ...cell, actionId } : cell)
            : [...cells, { position: editingPosition, span: 1, actionId }]
          ).sort((left, right) => left.position - right.position)
        }
      })
    })
    setEditingPosition(undefined)
    setPickerFilter('')
  }

  const clearPosition = (): void => {
    if (!draftLayout || editingPosition === undefined) return
    setDraftLayout({
      ...draftLayout,
      pages: draftLayout.pages.map(page => page.category !== category
        ? page
        : {
            ...page,
            cells: page.cells.map(cell => cell.position === editingPosition
              ? { ...cell, actionId: null }
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
          {editMode && (
          <section className="control-toolbar" aria-label="Control layout status">
            <p>
              <strong>{categoryLabel}</strong> ·{' '}
              <strong>{page?.cells.filter(cell => cell.actionId).length ?? 0}</strong> assigned ·{' '}
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
              const { action, position, span } = item
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
                    {item.actionId && <small>Missing: {item.actionId}</small>}
                  </button>
                )
              }
              const { definition } = action
              const pending = pendingActions.has(definition.id)
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

function actionComparator (left: GameActionAvailability, right: GameActionAvailability): number {
  if (left.available !== right.available) return left.available ? -1 : 1
  return left.definition.label.localeCompare(right.definition.label)
}

interface ControlGridItem {
  action?: GameActionAvailability
  actionId: string | null
  position: number
  span: number
}

function createGridItems (
  actions: GameActionAvailability[],
  page: ControlGridLayout['pages'][number] | undefined
): ControlGridItem[] {
  const actionsById = new Map(actions.map(action => [action.definition.id, action]))
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
    const actionId = cell?.actionId ?? null
    items.push({
      position,
      span: cell?.span ?? 1,
      actionId,
      action: actionId ? actionsById.get(actionId) : undefined
    })
  }
  return items
}

function telemetryState (runtimeState: RuntimeState | undefined, key: string | null): boolean {
  if (!key || !runtimeState?.gameStatus) return false
  const flags = runtimeState.gameStatus.flags as unknown as Record<string, boolean>
  return flags[key] === true
}
