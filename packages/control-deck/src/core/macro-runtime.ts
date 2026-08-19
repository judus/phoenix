import { MacroPlaybackSchema, type MacroPlayback } from './macros.js'
import type { CommandExecutor, MacroRepository } from './ports.js'

export interface MacroRuntimeClock {
  now(): Date
  randomId(): string
}

export class MacroPlaybackRunner {
  private active?: { controller: AbortController, state: MacroPlayback }

  public constructor (
    private readonly repository: MacroRepository,
    private readonly commands: CommandExecutor,
    private readonly clock: MacroRuntimeClock,
    private readonly timeoutMs = 60_000
  ) {}

  public getPlayback (): MacroPlayback | null { return this.active?.state ?? null }

  public async execute (macroId: string, origin: string, callerSignal?: AbortSignal): Promise<MacroPlayback> {
    if (this.active) throw new Error(`Macro ${this.active.state.macroId} is already running.`)
    const macro = this.repository.get(macroId)
    if (!macro?.enabled) throw new Error(`Macro ${macroId} is unavailable.`)
    const controller = new AbortController()
    const timeout = AbortSignal.timeout(this.timeoutMs)
    const signal = callerSignal ? AbortSignal.any([controller.signal, callerSignal, timeout]) : AbortSignal.any([controller.signal, timeout])
    const state = MacroPlaybackSchema.parse({
      completedSteps: 0,
      macroId,
      message: 'Macro playback running.',
      runId: this.clock.randomId(),
      startedAt: this.clock.now().toISOString(),
      status: 'running',
      totalSteps: macro.steps.length
    })
    this.active = { controller, state }
    const held = new Map<string, string>()
    try {
      for (const step of macro.steps) {
        signal.throwIfAborted()
        if (step.type === 'wait') {
          await abortableWait(step.durationMs, signal)
        } else {
          const leaseId = step.operation === 'press'
            ? held.get(step.commandId) ?? this.clock.randomId()
            : step.operation === 'release' ? held.get(step.commandId) : undefined
          const result = await this.commands.execute({
            commandId: step.commandId,
            operation: step.operation,
            ...(leaseId ? { leaseId } : {})
          }, origin, signal)
          if (!['accepted', 'confirmed', 'unconfirmed', 'already_satisfied'].includes(result.status)) throw new Error(result.message)
          if (step.operation === 'press') held.set(step.commandId, leaseId!)
          if (step.operation === 'release') held.delete(step.commandId)
        }
        state.completedSteps += 1
      }
      state.status = 'completed'
      state.message = 'Macro sequence completed; outcome is not confirmed.'
    } catch (cause) {
      const timedOut = isNamedError(signal.reason, 'TimeoutError')
      state.status = timedOut ? 'timed_out' : signal.aborted ? 'aborted' : 'failed'
      state.message = timedOut
        ? 'Macro playback timed out.'
        : signal.aborted ? 'Macro playback aborted.' : cause instanceof Error ? cause.message : 'Macro playback failed.'
    } finally {
      await Promise.allSettled([...held].map(([commandId, leaseId]) => this.commands.execute({ commandId, leaseId, operation: 'release' }, origin)))
      this.active = undefined
    }
    return MacroPlaybackSchema.parse(state)
  }

  public abortPlayback (): MacroPlayback | null {
    if (!this.active) return null
    this.active.controller.abort(Object.assign(new Error('Macro playback aborted.'), { name: 'AbortError' }))
    return this.active.state
  }
}

function isNamedError (value: unknown, name: string): boolean {
  return typeof value === 'object' && value !== null && 'name' in value && value.name === name
}

async function abortableWait (durationMs: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, durationMs)
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
  })
}
