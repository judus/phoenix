import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  GameActionAvailability,
  GameActionDefinition,
  GameActionOperation,
  GameActionResult,
  GameActionCatalogResponse,
  HealthResponse,
  RuntimeState
} from '@phoenix/contracts'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import { Page, PageContent, PageFooter, PageHeader } from '../components/layout/page.js'
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

const SHIP_COMMAND_ORDER = [
  'GalaxyMapOpen',
  'Supercruise',
  'Hyperspace',
  'UseBoostJuice',
  'SelectHighestThreat',
  'CyclePreviousHostileTarget',
  'CycleNextHostileTarget',
  'SystemMapOpen',
  'OrbitLinesToggle',
  'SelectTarget',
  'CyclePreviousSubsystem',
  'CycleNextSubsystem',
  'TargetNextRouteSystem',
  'ShipSpotLightToggle',
  'NightVisionToggle',
  'ToggleCargoScoop',
  'LandingGearToggle',
  'DeployHardpointToggle',
  'SilentRunning',
  'CyclePreviousTarget',
  'CycleNextTarget',
  'RecallDismissShip',
  'IncreaseEnginesPower',
  'IncreaseWeaponsPower',
  'IncreaseSystemsPower',
  'ResetPowerDistribution',
  'RadarDecreaseRange',
  'RadarIncreaseRange',
  'CycleFireGroupPrevious',
  'CycleFireGroupNext',
  'FireChaffLauncher',
  'DeployHeatSink',
  'UseShieldCell',
  'EjectAllCargo'
]

export interface ControlsPageProps {
  actionCatalog?: GameActionCatalogResponse
  category: ControlCategory
  error?: string
  health?: HealthResponse
  onExecuteAction: (actionId: string, operation: GameActionOperation) => Promise<GameActionResult>
  runtimeState?: RuntimeState
}

export function ControlsPage ({
  actionCatalog,
  category,
  error,
  health,
  onExecuteAction,
  runtimeState
}: ControlsPageProps) {
  const [filter, setFilter] = useState('')
  const [lastResult, setLastResult] = useState<GameActionResult>()
  const [localError, setLocalError] = useState<string>()
  const [pendingConfirmation, setPendingConfirmation] = useState<GameActionAvailability>()
  const [pendingActions, setPendingActions] = useState<ReadonlySet<string>>(new Set())
  const heldActions = useRef(new Set<string>())
  const actionQueues = useRef(new Map<string, Promise<void>>())
  const executeAction = useRef(onExecuteAction)
  executeAction.current = onExecuteAction

  const actions = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase()
    return (actionCatalog?.actions ?? [])
      .filter(action => action.definition.category === category)
      .filter(action => !normalizedFilter || [
        action.definition.label,
        action.definition.id,
        action.definition.eliteBinding,
        action.binding?.display
      ].some(value => value?.toLowerCase().includes(normalizedFilter)))
      .sort(actionComparator(category))
  }, [actionCatalog, category, filter])

  useEffect(() => {
    setPendingConfirmation(undefined)
    setFilter('')
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
          const result = await executeAction.current(actionId, operation)
          setLastResult(result)
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

  return (
    <PhoenixShell
      activePrimaryItemId="controls"
      activeSecondaryItemId={category}
      error={error ?? localError}
      health={health}
      secondaryNavigation={controlsNavigation}
    >
      <Page>
        <PageHeader
          eyebrow="Command interface"
          title={`${categoryLabel} Controls`}
          description="Commands are discovered from the active Elite Dangerous binding preset."
        />
        <PageContent>
          <section className="control-toolbar" aria-label="Control catalogue filters">
            <label>
              <span>Filter commands</span>
              <input
                type="search"
                value={filter}
                onChange={event => setFilter(event.target.value)}
                placeholder="Label, Elite command, or key"
              />
            </label>
            <p>
              <strong>{actions.length}</strong> commands ·{' '}
              <span>{backend?.id ?? 'backend pending'}</span> ·{' '}
              <span>{backend?.available ? 'live' : 'unavailable'}</span>
            </p>
          </section>

          {!actionCatalog && <p>Waiting for the action catalogue…</p>}

          <section className="control-grid" aria-label={`${categoryLabel} command grid`}>
            {actions.map(action => {
              const { definition } = action
              const pending = pendingActions.has(definition.id)
              const stateActive = telemetryState(runtimeState, definition.telemetryKey)
              return (
                <button
                  key={definition.id}
                  type="button"
                  className={`control-grid__button${stateActive ? ' control-grid__button--active' : ''}${definition.risk === 'dangerous' ? ' control-grid__button--dangerous' : ''}`}
                  disabled={!action.available}
                  aria-pressed={definition.telemetryKey ? stateActive : undefined}
                  onPointerDown={event => {
                    if (definition.inputMode === 'hold') {
                      event.preventDefault()
                      press(action, event.pointerId, event.currentTarget)
                    }
                  }}
                  onPointerUp={() => release(action)}
                  onPointerCancel={() => release(action)}
                  onClick={event => {
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
                    {definition.inputMode}{pending ? ' · sending' : ''}
                  </span>
                </button>
              )
            })}
          </section>

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

          {(localError || lastResult) && (
            <section className="control-result" aria-live="polite">
              {localError ?? `${lastResult?.status}: ${lastResult?.message}`}
            </section>
          )}
        </PageContent>
        <PageFooter>
          <span>{actionCatalog?.bindingSource.presetNames.join(' / ') || 'Binding preset pending'}</span>
          <span>{actionCatalog?.bindingSource.keyboardBindingCount ?? 0} keyboard bindings</span>
        </PageFooter>
      </Page>
    </PhoenixShell>
  )
}

function actionComparator (category: ControlCategory) {
  const preferredOrder = category === 'ship' ? new Map(SHIP_COMMAND_ORDER.map((id, index) => [id, index])) : null
  return (left: GameActionAvailability, right: GameActionAvailability): number => {
    const leftOrder = preferredOrder?.get(left.definition.eliteBinding) ?? Number.MAX_SAFE_INTEGER
    const rightOrder = preferredOrder?.get(right.definition.eliteBinding) ?? Number.MAX_SAFE_INTEGER
    if (leftOrder !== rightOrder) return leftOrder - rightOrder
    if (left.available !== right.available) return left.available ? -1 : 1
    return left.definition.label.localeCompare(right.definition.label)
  }
}

function telemetryState (runtimeState: RuntimeState | undefined, key: string | null): boolean {
  if (!key || !runtimeState?.gameStatus) return false
  const flags = runtimeState.gameStatus.flags as unknown as Record<string, boolean>
  return flags[key] === true
}
