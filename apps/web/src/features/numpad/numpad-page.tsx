import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { NumpadExecutionResult, NumpadTreeNode, PhoenixModules } from '@phoenix/contracts'
import { Button, PageFrame, Status } from '@phoenix/ui'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { NumpadRouteSession } from '../../application/navigation/numpad-route-session.js'
import type { DevicePreferences } from '../../application/settings/device-preferences.js'
import { activateNumpadSession, cancelNumpadSession, confirmNumpadSelection, currentNumpadParent, displayedNumpadAddress, enterNumpadDigitOrCancel, executingNumpadSession, finishNumpadSession, idleNumpadSession, selectNumpadNode, visibleNumpadNodes, type NumpadSessionState, type NumpadSessionTransition } from './numpad-session.js'
import { NumpadTileGrid } from './numpad-tile-grid.js'
import type { NumpadControllerSnapshot } from './use-numpad-controller.js'

export function NumpadPage({ api, controller, devicePreferences, routeSession }: { api: PhoenixApi, controller: NumpadControllerSnapshot, devicePreferences: DevicePreferences, routeSession: NumpadRouteSession }) {
  const [session, setSession] = useState<NumpadSessionState>(() => routeSession.isArmed() ? activateNumpadSession().state : idleNumpadSession())
  const [settings, setSettings] = useState<PhoenixModules | undefined>(() => controller.settings)
  const deviceSettings = useSyncExternalStore(devicePreferences.subscribe, devicePreferences.getSnapshot, devicePreferences.getSnapshot)
  const revision = useRef<number | undefined>(undefined)
  useEffect(() => { routeSession.acknowledge() }, [routeSession])
  useEffect(() => {
    if (!controller.settings) return
    setSettings(controller.settings)
  }, [controller.settings])
  useEffect(() => {
    const next = controller.snapshot?.revision
    if (session.active && revision.current !== undefined && next !== revision.current) setSession(current => finishNumpadSession(current, 'stale', 'Command map updated. Press 0 to restart.'))
    revision.current = next
  }, [controller.snapshot?.revision, session.active])
  const snapshot = controller.snapshot
  const alwaysConfirm = settings?.numpadCommands.alwaysConfirm === true
  const execute = async (node: NumpadTreeNode) => {
    if (!snapshot) return
    setSession(current => executingNumpadSession(current))
    try { applyExecution(await api.executeNumpadAddress(node.address, snapshot.revision)) } catch (cause) { setSession(current => finishNumpadSession(current, 'error', cause instanceof Error ? cause.message : 'Command execution failed.')) }
  }
  const apply = (transition: NumpadSessionTransition) => { setSession(transition.state); if (transition.execute) void execute(transition.execute) }
  const applyExecution = (result: NumpadExecutionResult) => {
    setSession(current => finishNumpadSession(current, result.status === 'accepted' ? 'completed' : result.status === 'stale' ? 'stale' : 'error', result.message))
    if (result.command?.navigationHref) { routeSession.navigate(result.command.navigationHref); return }
    if (result.status === 'accepted' && routeSession.leave()) return
  }
  const cancel = () => { setSession(cancelNumpadSession().state); routeSession.leave() }
  useEffect(() => {
    if (!snapshot) return
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))) return
      const digit = event.code.match(/^Numpad([0-9])$/u)?.[1]
      if (!session.active && event.code === 'Numpad0') { event.preventDefault(); apply(activateNumpadSession()); return }
      if (!session.active) return
      if (digit) {
        event.preventDefault()
        const transition = enterNumpadDigitOrCancel(snapshot, session, digit, alwaysConfirm)
        if (!transition.state.active) cancel()
        else apply(transition)
      }
      else if (event.code === 'NumpadDecimal' || event.key === '.') { event.preventDefault(); cancel() }
      else if (event.code === 'NumpadEnter' || event.key === 'Enter') { event.preventDefault(); apply(confirmNumpadSelection(snapshot, session)) }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  }, [alwaysConfirm, session, snapshot])
  const parent = snapshot ? currentNumpadParent(snapshot, session) : undefined

  return <PageFrame className="numpad-page" layout="fit">
    {controller.error ? <Status tone="danger">{controller.error}</Status> : controller.status === 'loading' || !settings || !snapshot ? <Status tone="muted">Loading command map…</Status> : <div className="numpad-console"><header><div><small>Address</small><strong>{displayedNumpadAddress(snapshot, session)}</strong></div><div><small>Context</small><strong>{parent?.label ?? 'Command root'}</strong></div><div><small>Status</small><strong>{session.active ? session.message ?? session.status : 'Press Numpad 0'}</strong></div><Button variant="quiet" onClick={cancel}>Cancel ·</Button></header><NumpadTileGrid columns={parent?.columns ?? (parent ? undefined : 3)} rows={parent?.rows} nodes={visibleNumpadNodes(snapshot, session)} pendingDigits={session.pendingDigits} variableFontSizes={deviceSettings.variableNumpadFontSizes} onSelect={nodeId => apply(selectNumpadNode(snapshot, session.active ? session : activateNumpadSession().state, nodeId, alwaysConfirm))} /></div>}
  </PageFrame>
}
