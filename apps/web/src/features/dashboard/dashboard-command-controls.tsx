import { useMemo, useState } from 'react'
import type { GameActionAvailability, GameActionCatalogResponse, GameActionResult } from '@phoenix/contracts'
import { TileButton } from '@phoenix/ui'

const RADIO_ACTION_ID = 'elite.GalnetAudio_Play_Pause'
const ROUTE_ACTION_ID = 'elite.TargetNextRouteSystem'

export interface DashboardCommandVoice {
  connected: boolean
  connect(): Promise<void>
  disconnect(): void
  transitioning: boolean
}

export function DashboardCommandControls({ actions, onExecute, voice }: {
  actions?: GameActionCatalogResponse
  onExecute(actionId: string): Promise<GameActionResult>
  voice: DashboardCommandVoice
}) {
  const catalogue = useMemo(
    () => new Map(actions?.actions.map(action => [action.definition.id, action]) ?? []),
    [actions]
  )
  const radio = catalogue.get(RADIO_ACTION_ID)
  const route = catalogue.get(ROUTE_ACTION_ID)
  const [pending, setPending] = useState<string>()
  const [feedback, setFeedback] = useState<string>()

  const execute = async (action: GameActionAvailability): Promise<void> => {
    if (!action.available || pending) return
    setPending(action.definition.id)
    setFeedback(undefined)
    try {
      const result = await onExecute(action.definition.id)
      setFeedback(result.message)
    } catch (cause) {
      setFeedback(cause instanceof Error ? cause.message : 'Dashboard command failed.')
    } finally {
      setPending(undefined)
    }
  }

  return (
    <div aria-label="Dashboard commands" className="dashboard-command-slots">
      <TileButton
        aria-label={voice.connected ? 'Disconnect Copilot voice' : 'Connect Copilot voice'}
        aria-pressed={voice.connected}
        className={voice.connected ? 'active' : undefined}
        disabled={voice.transitioning}
        label="COPILOT"
        note={voice.transitioning ? 'WAIT' : voice.connected ? 'ON' : 'OFF'}
        type="button"
        onClick={() => voice.connected ? voice.disconnect() : void voice.connect()}
      />
      <GameActionButton action={route} ariaLabel="Target next route system" label="ROUTE" pending={pending} onExecute={execute} />
      <TileButton
        aria-label="Request docking unavailable"
        disabled
        label="DOCK"
        note="N/A"
        title="Docking request is not available yet."
        type="button"
      />
      <GameActionButton action={radio} ariaLabel="Toggle GalNet Radio playback" label="RADIO" pending={pending} onExecute={execute} />
      <span aria-live="polite" className="sr-only">{feedback}</span>
    </div>
  )
}

function GameActionButton({ action, ariaLabel, label, onExecute, pending }: {
  action?: GameActionAvailability
  ariaLabel: string
  label: string
  onExecute(action: GameActionAvailability): Promise<void>
  pending?: string
}) {
  const executing = action?.definition.id === pending
  return (
    <TileButton
      aria-label={ariaLabel}
      disabled={!action?.available || pending !== undefined}
      label={label}
      note={executing ? 'WAIT' : 'TAP'}
      title={action?.unavailableReason ?? action?.definition.description ?? `${label} command unavailable.`}
      type="button"
      onClick={() => action && void onExecute(action)}
    />
  )
}
