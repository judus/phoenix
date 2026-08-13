import { useMemo, useState } from 'react'
import type {
  GameActionAvailability,
  GameActionCatalogResponse,
  GameActionOperation,
  GameActionResult
} from '@phoenix/contracts'

const radioCommands = [
  { actionId: 'elite.GalnetAudio_SkipBackward', label: 'Previous', symbol: '◀◀' },
  { actionId: 'elite.GalnetAudio_Play_Pause', label: 'Play or pause', symbol: '▶' },
  { actionId: 'elite.GalnetAudio_SkipForward', label: 'Next', symbol: '▶▶' },
  { actionId: 'elite.GalnetAudio_ClearQueue', label: 'Clear queue', symbol: '■' }
] as const

export interface GalnetRadioControlsProps {
  actionCatalog?: GameActionCatalogResponse
  compact?: boolean
  onExecuteAction: (actionId: string, operation: GameActionOperation) => Promise<GameActionResult>
}

export function GalnetRadioControls ({ actionCatalog, compact = false, onExecuteAction }: GalnetRadioControlsProps) {
  const [pendingActionId, setPendingActionId] = useState<string>()
  const [result, setResult] = useState<string>()
  const [error, setError] = useState<string>()
  const actions = useMemo(() => new Map(
    actionCatalog?.actions.map(action => [action.definition.id, action]) ?? []
  ), [actionCatalog])

  const execute = async (action: GameActionAvailability): Promise<void> => {
    if (!action.available || pendingActionId) return
    setPendingActionId(action.definition.id)
    setError(undefined)
    try {
      const outcome = await onExecuteAction(action.definition.id, 'tap')
      setResult(outcome.message)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'GalNet Audio command failed.')
    } finally {
      setPendingActionId(undefined)
    }
  }

  const unavailableCount = radioCommands.filter(command => !actions.get(command.actionId)?.available).length
  const status = error ?? result ?? (actionCatalog === undefined
    ? 'Loading configured GalNet Audio commands…'
    : unavailableCount === radioCommands.length
      ? 'Bind GalNet Audio controls in Elite Dangerous to enable this remote.'
      : 'Remote controls Elite Dangerous; playback state is not available in telemetry.')

  return (
    <div className={compact ? 'galnet-radio galnet-radio--compact' : 'galnet-radio'}>
      <div className="galnet-radio__identity">
        <strong>GalNet Audio</strong>
        <span>In-game radio remote</span>
      </div>
      <div className="galnet-radio__controls" aria-label="GalNet Audio controls">
        {radioCommands.map(command => {
          const action = actions.get(command.actionId)
          const disabled = !action?.available || pendingActionId !== undefined
          return (
            <button
              type="button"
              aria-label={command.label}
              disabled={disabled}
              key={command.actionId}
              title={action?.unavailableReason ?? command.label}
              onClick={() => action && void execute(action)}
            >
              <span aria-hidden="true">{command.symbol}</span>
              {!compact && <small>{command.label}</small>}
            </button>
          )
        })}
      </div>
      <p className={error ? 'galnet-radio__status is-error' : 'galnet-radio__status'}>{status}</p>
    </div>
  )
}
