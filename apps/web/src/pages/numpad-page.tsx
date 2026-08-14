import { useEffect, useRef, useState } from 'react'
import {
  CommandCatalogueRevisionSchema,
  type HealthResponse,
  type NumpadExecutionResult,
  type NumpadTreeNode,
  type NumpadTreeSnapshot,
  type PhoenixModules
} from '@phoenix/contracts'
import type { PhoenixApi } from '../api/phoenix-api-client.js'
import { subscribePhoenixEvent } from '../api/phoenix-event-stream.js'
import { Page, PageContent, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'
import { NumpadTileGrid } from '../features/numpad/numpad-tile-grid.js'
import {
  allowsRemoteDisplayCommands,
  setAllowsRemoteDisplayCommands
} from '../features/display/display-command-preferences.js'
import {
  acknowledgeNumpadRouteActivation,
  discardNumpadReturnRoute,
  leaveNumpadRoute,
  numpadRouteIsArmed
} from '../features/numpad/numpad-route-session.js'
import {
  activateNumpadSession,
  cancelNumpadSession,
  confirmNumpadSelection,
  currentNumpadParent,
  displayedNumpadAddress,
  enterNumpadDigit,
  executingNumpadSession,
  finishNumpadSession,
  idleNumpadSession,
  selectNumpadNode,
  visibleNumpadNodes,
  type NumpadSessionState,
  type NumpadSessionTransition
} from '../features/numpad/numpad-session.js'

const navigation: NavigationItem[] = [
  { href: '#/numpad', icon: '123', id: 'navigator', label: 'Command navigator' }
]

export interface NumpadPageProps {
  api: PhoenixApi
  error?: string
  health?: HealthResponse
}

export function NumpadPage ({ api, error, health }: NumpadPageProps) {
  const [snapshot, setSnapshot] = useState<NumpadTreeSnapshot>()
  const [settings, setSettings] = useState<PhoenixModules>()
  const [session, setSession] = useState<NumpadSessionState>(() => (
    numpadRouteIsArmed() ? activateNumpadSession().state : idleNumpadSession()
  ))
  const [localError, setLocalError] = useState<string>()
  const [allowRemoteDisplay, setAllowRemoteDisplay] = useState(allowsRemoteDisplayCommands)
  const snapshotRevision = useRef(0)

  useEffect(() => {
    snapshotRevision.current = snapshot?.revision ?? 0
  }, [snapshot?.revision])

  useEffect(() => {
    acknowledgeNumpadRouteActivation()
  }, [])

  useEffect(() => {
    let active = true
    const load = async (): Promise<void> => {
      const [nextSnapshot, nextSettings] = await Promise.all([api.getNumpadSnapshot(), api.getModuleSettings()])
      if (!active) return
      setSnapshot(nextSnapshot)
      setSettings(nextSettings)
    }
    void load().catch(cause => setLocalError(message(cause, 'Numpad command map unavailable.')))
    const unsubscribe = subscribePhoenixEvent(api, 'command-catalogue', event => {
      try {
        const revision = CommandCatalogueRevisionSchema.parse(JSON.parse(event.data))
        void Promise.all([api.getNumpadSnapshot(), api.getModuleSettings()])
          .then(([nextSnapshot, nextSettings]) => {
            if (!active) return
            setSnapshot(nextSnapshot)
            setSettings(nextSettings)
            setSession(current => current.active && revision.revision !== snapshotRevision.current
              ? finishNumpadSession(current, 'stale', 'Command map updated. Press 0 to restart.')
              : current)
          })
          .catch(cause => setLocalError(message(cause, 'Numpad command map unavailable.')))
      } catch (cause) {
        setLocalError(message(cause, 'Invalid command catalogue revision.'))
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [api])

  const enabled = settings?.numpadCommands.enabled === true
  const alwaysConfirm = settings?.numpadCommands.alwaysConfirm === true

  const execute = async (node: NumpadTreeNode): Promise<void> => {
    if (!snapshot) return
    setSession(current => executingNumpadSession(current))
    try {
      const result = await api.executeNumpadAddress(node.address, snapshot.revision)
      applyExecutionResult(result)
    } catch (cause) {
      setSession(current => finishNumpadSession(current, 'error', message(cause, 'Command execution failed.')))
    }
  }

  const apply = (transition: NumpadSessionTransition): void => {
    setSession(transition.state)
    if (transition.execute) void execute(transition.execute)
  }

  const applyExecutionResult = (result: NumpadExecutionResult): void => {
    if (result.command?.navigationHref) {
      discardNumpadReturnRoute()
      window.location.hash = result.command.navigationHref
      return
    }
    if (result.status === 'accepted' && leaveNumpadRoute()) return
    setSession(current => finishNumpadSession(
      current,
      result.status === 'accepted' ? 'completed' : result.status === 'stale' ? 'stale' : 'error',
      result.message
    ))
  }

  useEffect(() => {
    if (!snapshot || !enabled) return
    const handleKey = (event: KeyboardEvent): void => {
      if (isEditableTarget(event.target)) return
      const digit = numpadDigit(event)
      if (!session.active) {
        if (event.code !== 'Numpad0') return
        event.preventDefault()
        apply(activateNumpadSession())
        return
      }
      if (digit !== undefined) {
        event.preventDefault()
        apply(enterNumpadDigit(snapshot, session, digit, alwaysConfirm))
        return
      }
      if (event.code === 'NumpadDecimal' || event.key === '.') {
        event.preventDefault()
        cancelAndReturn()
        return
      }
      if (event.code === 'NumpadEnter' || event.key === 'Enter') {
        event.preventDefault()
        apply(confirmNumpadSelection(snapshot, session))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [alwaysConfirm, enabled, session, snapshot])

  useEffect(() => {
    if (!session.active || session.status === 'executing') return
    const timeout = window.setTimeout(cancelAndReturn, settings?.numpadCommands.cancelAfterMs ?? 5000)
    return () => window.clearTimeout(timeout)
  }, [session, settings?.numpadCommands.cancelAfterMs])

  const parent = snapshot ? currentNumpadParent(snapshot, session) : undefined
  const nodes = snapshot ? visibleNumpadNodes(snapshot, session) : []
  const address = snapshot ? displayedNumpadAddress(snapshot, session) : '0'

  const cancelAndReturn = (): void => {
    setSession(cancelNumpadSession().state)
    leaveNumpadRoute()
  }

  const saveNumpadSettings = async (next: PhoenixModules['numpadCommands']): Promise<void> => {
    if (!settings) return
    try {
      setSettings(await api.saveModuleSettings({ ...settings, numpadCommands: next }))
      setLocalError(undefined)
    } catch (cause) {
      setLocalError(message(cause, 'Unable to save numpad settings.'))
    }
  }

  return (
    <PhoenixShell
      activeSecondaryItemId="navigator"
      error={error ?? localError}
      health={health}
      secondaryNavigation={navigation}
      showPrimaryNavigation={false}
    >
      <Page className="numpad-page">
        <PageHeader
          title="Numpad"
          eyebrow="Command navigator"
          description="Device-local numerical access to PHOENIX destinations, controls, and macros."
          actions={settings && (
            <div className="numpad-settings">
              <label>
                <input
                  type="checkbox"
                  checked={alwaysConfirm}
                  disabled={!enabled}
                  onChange={event => void saveNumpadSettings({
                    ...settings.numpadCommands,
                    alwaysConfirm: event.target.checked
                  })}
                />
                Always confirm with Enter
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={allowRemoteDisplay}
                  onChange={event => {
                    setAllowsRemoteDisplayCommands(event.target.checked)
                    setAllowRemoteDisplay(event.target.checked)
                  }}
                />
                Follow remote display commands
              </label>
            </div>
          )}
        />
        <PageContent variant="bleed">
          {!settings || !snapshot
            ? <div className="numpad-standby">Loading command map…</div>
            : !enabled
              ? (
                  <div className="numpad-standby">
                    <strong>Numpad module disabled</strong>
                    <span>Enable it on this PHOENIX installation to accept numerical commands.</span>
                    <button
                      type="button"
                      onClick={() => void saveNumpadSettings({ ...settings.numpadCommands, enabled: true })}
                    >Enable numpad</button>
                  </div>
                )
              : (
                    <div className="numpad-console">
                      <header className="numpad-console__status">
                        <div><span>Address</span><strong>{address}</strong></div>
                        <div><span>Context</span><strong>{parent?.label ?? 'Command root'}</strong></div>
                        <div><span>Status</span><strong data-status={session.status}>{session.active ? session.message ?? session.status : 'Press Numpad 0'}</strong></div>
                        <button type="button" onClick={cancelAndReturn}>Cancel ·</button>
                      </header>
                      <NumpadTileGrid
                        columns={parent?.columns ?? (parent ? undefined : 3)}
                        rows={parent?.rows}
                        nodes={nodes}
                        pendingDigits={session.pendingDigits}
                        onSelect={nodeId => apply(selectNumpadNode(
                          snapshot,
                          session.active ? session : activateNumpadSession().state,
                          nodeId,
                          alwaysConfirm
                        ))}
                      />
                    </div>
                  )}
        </PageContent>
      </Page>
    </PhoenixShell>
  )
}

function numpadDigit (event: KeyboardEvent): string | undefined {
  const match = event.code.match(/^Numpad([0-9])$/u)
  return match?.[1]
}

function isEditableTarget (target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}

function message (cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback
}
