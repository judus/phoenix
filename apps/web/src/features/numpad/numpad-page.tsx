import { useSyncExternalStore } from 'react'
import { controlDeckNumpadChildren, displayedControlDeckNumpadAddress } from 'control-deck/core'
import { Button, PageFrame, Status } from '@phoenix/ui'
import type { DevicePreferences } from '../../application/settings/device-preferences.js'
import { NumpadTileGrid } from './numpad-tile-grid.js'
import type { NumpadRuntime } from './numpad-runtime.js'

export function NumpadPage({ runtime, devicePreferences }: { runtime: NumpadRuntime, devicePreferences: DevicePreferences }) {
  const map = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getSnapshot)
  const { session } = useSyncExternalStore(runtime.controller.subscribe, runtime.controller.getSnapshot, runtime.controller.getSnapshot)
  const deviceSettings = useSyncExternalStore(devicePreferences.subscribe, devicePreferences.getSnapshot, devicePreferences.getSnapshot)
  const tree = map.tree
  const parent = tree?.nodes.find(node => node.id === session.pathIds.at(-1))

  return <PageFrame className="numpad-page" layout="fit">
    {map.error ? <Status tone="danger">{map.error}</Status> : map.status === 'loading' || !tree ? <Status tone="muted">Loading command map…</Status> : <div className="numpad-console"><header>
      <div><small>Address</small><strong>{displayedControlDeckNumpadAddress(tree, session)}</strong></div>
      <div><small>Context</small><strong>{parent?.label ?? 'Command root'}</strong></div>
      <div><small>Status</small><strong>{session.message ?? (session.active ? session.status : 'Press Numpad 0')}</strong></div>
      <div><small>Cancel</small><Button aria-label="Cancel Numpy (Escape or decimal point)" variant="quiet" onClick={runtime.controller.cancel}><strong>Esc / .</strong></Button></div>
    </header><NumpadTileGrid columns={parent?.columns ?? (parent ? undefined : 3)} rows={parent?.rows} nodes={controlDeckNumpadChildren(tree, parent?.id ?? null)} pendingDigits={session.pendingDigits} variableFontSizes={deviceSettings.variableCommandLabelSizes} onSelect={runtime.controller.select} /></div>}
  </PageFrame>
}
