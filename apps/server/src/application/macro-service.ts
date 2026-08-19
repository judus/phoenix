import { randomUUID } from 'node:crypto'
import {
  MacroDefinitionSchema,
  MacroPlaybackSchema,
  MacroRecordingSchema,
  RecordMacroActionRequestSchema,
  type CopilotExecutionPermissions,
  type GameActionOrigin,
  type MacroPlayback,
  type MacroRecording
} from '@phoenix/contracts'
import type { GameActions } from './game-action-service.js'
import type { MacroRepository, Macros } from '../domain/macros.js'
import { isDangerousMacroAction, withEffectiveMacroRisk } from './macro-risk.js'

interface ActiveRecording extends MacroRecording { lastCompletedAt: number }

export class MacroService implements Macros {
  private readonly recordings = new Map<string, ActiveRecording>()
  private activeRun?: { controller: AbortController, state: MacroPlayback }

  public constructor (
    private readonly repository: MacroRepository,
    private readonly gameActions: GameActions,
    private readonly now: () => Date = () => new Date(),
    private readonly copilotPermissions: () => CopilotExecutionPermissions = () => ({
      gameActions: true,
      macros: true,
      dangerousActions: true
    })
  ) {}

  public getLibrary () { return this.repository.getLibrary() }
  public save (candidate: unknown) {
    const definition = MacroDefinitionSchema.parse(candidate)
    return this.repository.save(withEffectiveMacroRisk(definition, this.gameActions.getCatalog()))
  }
  public delete (id: string): void { this.repository.delete(id) }
  public getPlayback (): MacroPlayback | null { return this.activeRun?.state ?? null }

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

  public async recordAction (recordingId: string, candidate: unknown): Promise<MacroRecording> {
    const request = RecordMacroActionRequestSchema.parse(candidate)
    const recording = this.ownedRecording(recordingId, request.clientId)
    const emittedAt = this.now().getTime()
    const delayBeforeMs = recording.entries.length === 0
      ? 0
      : Math.max(0, emittedAt - recording.lastCompletedAt)
    const result = await this.gameActions.execute({
      actionId: request.actionId,
      operation: request.operation
    }, 'ui')
    recording.lastCompletedAt = this.now().getTime()
    recording.entries.push({
      actionId: request.actionId,
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
    if (this.activeRun) throw new Error(`Macro ${this.activeRun.state.macroId} is already running.`)
    const macro = this.repository.get(macroId)
    if (!macro?.enabled) throw new Error(`Macro ${macroId} is unavailable.`)
    const controller = new AbortController()
    const timeout = AbortSignal.timeout(60_000)
    const signal = callerSignal ? AbortSignal.any([controller.signal, callerSignal, timeout]) : AbortSignal.any([controller.signal, timeout])
    const state: MacroPlayback = MacroPlaybackSchema.parse({
      completedSteps: 0,
      macroId,
      message: 'Macro playback running.',
      runId: randomUUID(),
      startedAt: this.now().toISOString(),
      status: 'running',
      totalSteps: macro.steps.length
    })
    this.activeRun = { controller, state }
    const held = new Set<string>()
    try {
      for (const step of macro.steps) {
        if (signal.aborted) throw signal.reason
        if (step.type === 'wait') {
          await abortableWait(step.durationMs, signal)
        } else {
          if (origin === 'copilot' && !this.copilotPermissions().dangerousActions &&
              isDangerousMacroAction(step.actionId, this.gameActions.getCatalog())) {
            throw new Error('Dangerous Copilot actions are disabled in Settings.')
          }
          const result = await this.gameActions.execute({ actionId: step.actionId, operation: step.operation }, origin, signal)
          if (!['accepted', 'confirmed', 'unconfirmed', 'already_satisfied'].includes(result.status)) {
            throw new Error(result.message)
          }
          if (step.operation === 'press') held.add(step.actionId)
          if (step.operation === 'release') held.delete(step.actionId)
        }
        state.completedSteps += 1
      }
      state.status = 'completed'
      state.message = 'Macro sequence completed; game outcome is not confirmed.'
    } catch (cause) {
      const timedOut = signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError'
      state.status = timedOut ? 'timed_out' : signal.aborted ? 'aborted' : 'failed'
      state.message = timedOut
        ? 'Macro playback timed out.'
        : signal.aborted ? 'Macro playback aborted.' : cause instanceof Error ? cause.message : 'Macro playback failed.'
    } finally {
      await Promise.all([...held].map(actionId => this.gameActions.execute({ actionId, operation: 'release' }, origin)))
      this.activeRun = undefined
    }
    return MacroPlaybackSchema.parse(state)
  }

  public abortPlayback (): MacroPlayback | null {
    if (!this.activeRun) return null
    this.activeRun.controller.abort(new DOMException('Macro playback aborted.', 'AbortError'))
    return this.activeRun.state
  }

  private ownedRecording (id: string, clientId: string): ActiveRecording {
    const recording = this.recordings.get(id)
    if (!recording || recording.clientId !== clientId) throw new Error('Macro recording session is unavailable.')
    return recording
  }
}

async function abortableWait (durationMs: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, durationMs)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    }, { once: true })
  })
}
