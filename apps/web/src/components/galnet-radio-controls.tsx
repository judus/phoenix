import { useMemo, useState } from 'react'
import { EqualGrid, IconButton } from '@phoenix/ui'
import type { GameActionAvailability, GameActionCatalogResponse, GameActionResult } from '@phoenix/contracts'

const RADIO_COMMANDS = [
  { actionId: 'elite.GalnetAudio_SkipBackward', label: 'Previous', icon: <PreviousIcon /> },
  { actionId: 'elite.GalnetAudio_Play_Pause', label: 'Play / pause', icon: <PlayPauseIcon /> },
  { actionId: 'elite.GalnetAudio_SkipForward', label: 'Next', icon: <NextIcon /> },
  { actionId: 'elite.GalnetAudio_ClearQueue', label: 'Clear queue', icon: <ClearQueueIcon /> }
] as const

export function GalnetRadioControls({ actionCatalog, className, onExecute }: {
  actionCatalog?: GameActionCatalogResponse
  className?: string
  onExecute(actionId: string): Promise<GameActionResult>
}) {
  const [pending, setPending] = useState<string>()
  const [result, setResult] = useState<{ message: string, failed: boolean }>()
  const actions = useMemo(() => new Map(
    actionCatalog?.actions.map(action => [action.definition.id, action]) ?? []
  ), [actionCatalog])

  const execute = async (action: GameActionAvailability): Promise<void> => {
    if (!action.available || pending) return
    setPending(action.definition.id)
    try {
      const outcome = await onExecute(action.definition.id)
      setResult({ message: outcome.message, failed: outcome.status === 'failed' || outcome.status === 'rejected' })
    } catch (cause) {
      setResult({ failed: true, message: cause instanceof Error ? cause.message : 'GalNet Audio command failed.' })
    } finally {
      setPending(undefined)
    }
  }

  const available = RADIO_COMMANDS.some(command => actions.get(command.actionId)?.available)
  const status = result?.message ?? (actionCatalog === undefined
    ? 'Loading configured commands…'
    : available
      ? 'Command acceptance only; playback state is not available in telemetry.'
      : 'Bind GalNet Audio controls in Elite Dangerous to enable this remote.')

  return (
    <>
      <EqualGrid className={className} columns={4} gap="xs" aria-label="GalNet Audio controls">
        {RADIO_COMMANDS.map(command => {
          const action = actions.get(command.actionId)
          return (
            <IconButton
              disabled={!action?.available || pending !== undefined}
              key={command.actionId}
              label={command.label}
              shape="landscape"
              size="md"
              title={action?.unavailableReason ?? command.label}
              onClick={() => action && void execute(action)}
            >
              {command.icon}
            </IconButton>
          )
        })}
      </EqualGrid>
      <span aria-live="polite" className="sr-only">{status}</span>
    </>
  )
}

function PreviousIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 5v14M19 5 8 12l11 7V5Z" /></svg> }
function ClearQueueIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h10M3 18h10m3-5 6 6m0-6-6 6" stroke="currentColor" strokeWidth="1.75" /></svg> }
function PlayPauseIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 5 10 7L3 19V5Zm12 0h3v14h-3zm5 0h3v14h-3z" /></svg> }
function NextIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 5v14M5 5l11 7-11 7V5Z" /></svg> }
