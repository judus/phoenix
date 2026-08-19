import { randomUUID } from 'node:crypto'
import {
  CommandExecutionResultSchema,
  MacroDefinitionSchema,
  MacroPlaybackRunner,
  MacroRecordingSchema,
  RecordMacroCommandRequestSchema,
  gameActionCommandId,
  type CopilotExecutionPermissions,
  type GameActionOrigin,
  type MacroPlayback,
  type MacroRecording
} from '@phoenix/contracts'
import type { GameActions } from './game-action-service.js'
import type { MacroRepository, Macros } from '../domain/macros.js'
import { isDangerousMacroCommand, withEffectiveMacroRisk } from './macro-risk.js'

interface ActiveRecording extends MacroRecording { lastCompletedAt: number }

export class MacroService implements Macros {
  private readonly recordings = new Map<string, ActiveRecording>()
  private readonly playback: MacroPlaybackRunner

  public constructor (
    private readonly repository: MacroRepository,
    private readonly gameActions: GameActions,
    private readonly now: () => Date = () => new Date(),
    private readonly copilotPermissions: () => CopilotExecutionPermissions = () => ({
      gameActions: true,
      macros: true,
      dangerousActions: true
    })
  ) {
    this.playback = new MacroPlaybackRunner(
      repository,
      {
        execute: async (request, origin, signal) => {
          if (origin === 'copilot' && !this.copilotPermissions().dangerousActions &&
              isDangerousMacroCommand(request.commandId, this.gameActions.getCatalog())) {
            return commandResult(request.commandId, request.operation, origin, 'rejected', 'Dangerous Copilot actions are disabled in Settings.', this.now())
          }
          try {
            const result = await this.gameActions.execute({
              actionId: actionId(request.commandId),
              operation: request.operation,
              ...(request.leaseId ? { leaseId: request.leaseId } : {})
            }, origin as GameActionOrigin, signal)
            return CommandExecutionResultSchema.parse({
              commandId: request.commandId,
              correlationId: result.correlationId,
              effects: [{ type: 'game-action', payload: { result } }],
              message: result.message,
              operation: result.operation,
              origin: result.origin,
              requestId: result.requestId,
              status: result.status,
              timestamp: result.timestamp
            })
          } catch (cause) {
            return commandResult(request.commandId, request.operation, origin, 'rejected', cause instanceof Error ? cause.message : 'Macro command is unavailable.', this.now())
          }
        }
      },
      { now: this.now, randomId: randomUUID }
    )
  }

  public getLibrary () { return this.repository.getLibrary() }
  public save (candidate: unknown) {
    const definition = MacroDefinitionSchema.parse(candidate)
    return this.repository.save(withEffectiveMacroRisk(definition, this.gameActions.getCatalog()))
  }
  public delete (id: string): void { this.repository.delete(id) }
  public getPlayback (): MacroPlayback | null { return this.playback.getPlayback() }

  public startRecording (clientId: string): MacroRecording {
    const startedAt = this.now()
    const recording: ActiveRecording = {
      clientId,
      entries: [],
      id: randomUUID(),
      lastCompletedAt: startedAt.getTime(),
      startedAt: startedAt.toISOString(),
      status: 'recording'
    }
    this.recordings.set(recording.id, recording)
    return MacroRecordingSchema.parse(recording)
  }

  public async recordCommand (recordingId: string, candidate: unknown): Promise<MacroRecording> {
    const request = RecordMacroCommandRequestSchema.parse(candidate)
    const recording = this.ownedRecording(recordingId, request.clientId)
    const emittedAt = this.now().getTime()
    const delayBeforeMs = recording.entries.length === 0
      ? 0
      : Math.max(0, emittedAt - recording.lastCompletedAt)
    const result = await this.gameActions.execute({
      actionId: actionId(request.commandId),
      operation: request.operation
    }, 'ui')
    recording.lastCompletedAt = this.now().getTime()
    recording.entries.push({
      commandId: request.commandId,
      delayBeforeMs,
      message: result.message,
      operation: request.operation,
      status: result.status
    })
    return MacroRecordingSchema.parse(recording)
  }

  public stopRecording (recordingId: string, clientId: string): MacroRecording {
    const recording = this.ownedRecording(recordingId, clientId)
    recording.status = 'stopped'
    this.recordings.delete(recordingId)
    return MacroRecordingSchema.parse(recording)
  }

  public cancelRecording (recordingId: string, clientId: string): void {
    this.ownedRecording(recordingId, clientId)
    this.recordings.delete(recordingId)
  }

  public async execute (macroId: string, origin: GameActionOrigin, callerSignal?: AbortSignal): Promise<MacroPlayback> {
    return this.playback.execute(macroId, origin, callerSignal)
  }

  public abortPlayback (): MacroPlayback | null {
    return this.playback.abortPlayback()
  }

  private ownedRecording (id: string, clientId: string): ActiveRecording {
    const recording = this.recordings.get(id)
    if (!recording || recording.clientId !== clientId) throw new Error('Macro recording session is unavailable.')
    return recording
  }
}

function actionId (commandId: string): string {
  const prefix = gameActionCommandId('')
  if (!commandId.startsWith(prefix) || commandId.startsWith('command.navigation.') || commandId.startsWith('command.macro.')) {
    throw new Error(`Phoenix macros cannot execute non-game command ${commandId}.`)
  }
  return commandId.slice(prefix.length)
}

function commandResult (
  commandId: string,
  operation: 'tap' | 'press' | 'release',
  origin: string,
  status: 'rejected',
  message: string,
  now: Date
) {
  const requestId = randomUUID()
  return CommandExecutionResultSchema.parse({
    commandId,
    correlationId: requestId,
    effects: [],
    message,
    operation,
    origin,
    requestId,
    status,
    timestamp: now.toISOString()
  })
}
