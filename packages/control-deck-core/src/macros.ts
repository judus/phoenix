import { z } from 'zod'
import {
  ControlDeckCommandTargetSchema,
  type ControlDeckAdapterCommand,
  type ControlDeckAdapterExecutionResult,
  type ControlDeckCommandAdapter,
  type ControlDeckCommandExecutionResult,
  type ControlDeckCommandInvocation,
  type ControlDeckCommandTarget
} from './commands.js'

const MacroIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/u)

export const ControlDeckMacroStepSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('command'),
    target: ControlDeckCommandTargetSchema,
    operation: z.enum(['tap', 'press', 'release']).default('tap')
  }),
  z.object({
    type: z.literal('wait'),
    durationMs: z.number().int().min(0).max(30_000)
  })
])

export const ControlDeckMacroDefinitionSchema = z.object({
  version: z.literal(1),
  id: MacroIdSchema,
  name: z.string().min(1).max(80),
  description: z.string().max(500).default(''),
  enabled: z.boolean().default(true),
  steps: z.array(ControlDeckMacroStepSchema).min(1).max(128)
})

export const ControlDeckMacroLibrarySchema = z.object({
  version: z.literal(1),
  macros: z.array(ControlDeckMacroDefinitionSchema).max(256)
}).superRefine((library, context) => {
  const ids = new Set<string>()
  for (const [index, macro] of library.macros.entries()) {
    if (ids.has(macro.id)) context.addIssue({ code: 'custom', message: `Duplicate macro id: ${macro.id}.`, path: ['macros', index, 'id'] })
    ids.add(macro.id)
  }
})

export const ControlDeckMacroPlaybackSchema = z.object({
  macroId: MacroIdSchema,
  runId: z.string().min(1),
  startedAt: z.iso.datetime(),
  completedSteps: z.number().int().nonnegative(),
  totalSteps: z.number().int().nonnegative(),
  status: z.enum(['running', 'completed', 'cancelled', 'failed', 'timed_out']),
  message: z.string().min(1)
})

export type ControlDeckMacroStep = z.infer<typeof ControlDeckMacroStepSchema>
export type ControlDeckMacroDefinition = z.infer<typeof ControlDeckMacroDefinitionSchema>
export type ControlDeckMacroLibrary = z.infer<typeof ControlDeckMacroLibrarySchema>
export type ControlDeckMacroPlayback = z.infer<typeof ControlDeckMacroPlaybackSchema>

export interface ControlDeckMacroRepository {
  delete(id: string): void
  get(id: string): ControlDeckMacroDefinition | null
  getLibrary(): ControlDeckMacroLibrary
  save(macro: ControlDeckMacroDefinition): ControlDeckMacroDefinition
}

export interface ControlDeckMacroCommandExecutor {
  execute(
    request: { target: ControlDeckCommandTarget, operation: 'tap' | 'press' | 'release', leaseId?: string, timeoutMs?: number },
    ownerKey: string,
    signal?: AbortSignal
  ): Promise<ControlDeckCommandExecutionResult>
}

export interface ControlDeckMacroAdapterOptions {
  createId: () => string
  executor: ControlDeckMacroCommandExecutor
  now?: () => number
  resolveCommand: (target: ControlDeckCommandTarget) => ControlDeckAdapterCommand | null
  validateCommand?: (target: ControlDeckCommandTarget) => string | null
  renewalMs?: number
}

interface HeldCommand {
  leaseId: string
  renewal: ReturnType<typeof setInterval>
  target: ControlDeckCommandTarget
}

const SUCCESSFUL_STATUSES = new Set(['accepted', 'confirmed', 'unconfirmed', 'already_satisfied'])
const RISK_ORDER = ['safe', 'caution', 'dangerous', 'destructive'] as const

export class ControlDeckMacroCommandAdapter implements ControlDeckCommandAdapter {
  private active?: { controller: AbortController, playback: ControlDeckMacroPlayback }
  private readonly now: () => number
  private readonly renewalMs: number

  public constructor (
    private readonly repository: ControlDeckMacroRepository,
    private readonly options: ControlDeckMacroAdapterOptions
  ) {
    this.now = options.now ?? Date.now
    this.renewalMs = options.renewalMs ?? 5_000
  }

  public describe () {
    return {
      id: 'builtin.macro',
      version: '1',
      label: 'Macros',
      available: true,
      simulated: false,
      detail: 'Saved Control Deck command sequences.',
      platformRequirements: [],
      holdOwner: 'adapter' as const,
      commands: this.repository.getLibrary().macros.map(macro => this.describeMacro(macro))
    }
  }

  public validate (target: ControlDeckCommandTarget): string | null {
    if (target.adapterId !== 'builtin.macro') return 'Unsupported macro command target.'
    if (Object.keys(target.configuration).length > 0) return 'Macro commands do not accept configuration.'
    const macro = this.repository.get(target.commandId)
    if (!macro) return `Unknown macro: ${target.commandId}.`
    if (!macro.enabled) return `Macro ${macro.name} is disabled.`
    const invalid = this.invalidStep(macro)
    return invalid === null ? null : invalid
  }

  public async execute (
    invocation: ControlDeckCommandInvocation,
    signal: AbortSignal
  ): Promise<ControlDeckAdapterExecutionResult> {
    if (invocation.operation !== 'tap') return { status: 'rejected', message: 'Macros support tap execution only.' }
    if (this.active) return { status: 'rejected', message: `Macro ${this.active.playback.macroId} is already running.` }
    const macro = this.repository.get(invocation.target.commandId)
    if (!macro?.enabled) return { status: 'rejected', message: `Macro ${invocation.target.commandId} is unavailable.` }
    const invalid = this.invalidStep(macro)
    if (invalid) return { status: 'rejected', message: invalid }
    const simulated = this.describeMacro(macro).simulated

    const controller = new AbortController()
    const executionSignal = AbortSignal.any([signal, controller.signal])
    const playback: ControlDeckMacroPlayback = ControlDeckMacroPlaybackSchema.parse({
      macroId: macro.id,
      runId: this.options.createId(),
      startedAt: new Date(this.now()).toISOString(),
      completedSteps: 0,
      totalSteps: macro.steps.length,
      status: 'running',
      message: 'Macro playback running.'
    })
    this.active = { controller, playback }
    const held = new Map<string, HeldCommand>()
    const ownerKey = `macro:${invocation.ownerKey}:${playback.runId}`
    try {
      for (const step of macro.steps) {
        executionSignal.throwIfAborted()
        if (step.type === 'wait') {
          await abortableWait(step.durationMs, executionSignal)
        } else {
          await this.executeStep(step, held, ownerKey, executionSignal)
        }
        playback.completedSteps++
      }
      playback.status = 'completed'
      playback.message = 'Macro completed; target application outcomes are not confirmed.'
      return { status: 'accepted', message: playback.message, simulated, data: ControlDeckMacroPlaybackSchema.parse(playback) }
    } catch (cause) {
      const timedOut = executionSignal.reason instanceof DOMException && executionSignal.reason.name === 'TimeoutError'
      playback.status = timedOut ? 'timed_out' : executionSignal.aborted ? 'cancelled' : 'failed'
      playback.message = timedOut
        ? 'Macro playback timed out.'
        : executionSignal.aborted ? 'Macro playback cancelled.' : cause instanceof Error ? cause.message : 'Macro playback failed.'
      return {
        status: timedOut ? 'timed_out' : executionSignal.aborted ? 'cancelled' : 'failed',
        message: playback.message,
        simulated,
        data: ControlDeckMacroPlaybackSchema.parse(playback)
      }
    } finally {
      await this.releaseHeld(held, ownerKey)
      this.active = undefined
    }
  }

  public getPlayback (): ControlDeckMacroPlayback | null {
    return this.active ? ControlDeckMacroPlaybackSchema.parse(this.active.playback) : null
  }

  public abortPlayback (): ControlDeckMacroPlayback | null {
    if (!this.active) return null
    this.active.controller.abort(new DOMException('Macro playback cancelled.', 'AbortError'))
    return ControlDeckMacroPlaybackSchema.parse(this.active.playback)
  }

  public stop (): void { this.abortPlayback() }

  private describeMacro (macro: ControlDeckMacroDefinition): ControlDeckAdapterCommand {
    const commands = macro.steps.flatMap(step => step.type === 'command' ? [this.options.resolveCommand(step.target)] : []).filter(command => command !== null)
    const invalid = this.invalidStep(macro)
    return {
      id: macro.id,
      label: macro.name,
      description: macro.description || `Run the ${macro.name} macro.`,
      category: 'Macros',
      available: macro.enabled && invalid === null,
      unavailableReason: macro.enabled ? invalid : `Macro ${macro.name} is disabled.`,
      risk: commands.reduce<(typeof RISK_ORDER)[number]>((risk, command) =>
        RISK_ORDER.indexOf(command.risk) > RISK_ORDER.indexOf(risk) ? command.risk : risk, 'safe'),
      simulated: commands.length > 0 && commands.every(command => command.simulated),
      operations: ['tap'],
      timeoutMs: 60_000,
      configurationSchema: { type: 'object', additionalProperties: false, properties: {} }
    }
  }

  private invalidStep (macro: ControlDeckMacroDefinition): string | null {
    for (const [index, step] of macro.steps.entries()) {
      if (step.type === 'wait') continue
      if (step.target.adapterId === 'builtin.macro') return `Macro step ${index + 1} cannot invoke another macro.`
      const command = this.options.resolveCommand(step.target)
      if (!command) return `Macro step ${index + 1} references an unknown command.`
      const validationError = this.options.validateCommand?.(step.target)
      if (validationError) return `Macro step ${index + 1} is invalid: ${validationError}`
      if (!command.available) return `Macro step ${index + 1} is unavailable: ${command.unavailableReason ?? command.label}.`
      if (!command.operations.includes(step.operation)) return `Macro step ${index + 1} does not support ${step.operation}.`
    }
    return null
  }

  private async executeStep (
    step: Extract<ControlDeckMacroStep, { type: 'command' }>,
    held: Map<string, HeldCommand>,
    ownerKey: string,
    signal: AbortSignal
  ): Promise<void> {
    const key = stableTargetKey(step.target)
    const active = held.get(key)
    const leaseId = step.operation === 'press'
      ? active?.leaseId ?? this.options.createId()
      : step.operation === 'release' ? active?.leaseId : undefined
    if (step.operation === 'release' && !leaseId) throw new Error('Macro attempted to release a command it does not hold.')
    const result = await this.options.executor.execute({
      target: step.target,
      operation: step.operation,
      ...(leaseId ? { leaseId } : {}),
      timeoutMs: 10_000
    }, ownerKey, signal)
    if (!SUCCESSFUL_STATUSES.has(result.status)) throw new Error(result.message)
    if (step.operation === 'press' && !active) {
      const renewal = setInterval(() => {
        void this.options.executor.execute({ target: step.target, operation: 'press', leaseId, timeoutMs: 10_000 }, ownerKey)
          .then(result => { if (!SUCCESSFUL_STATUSES.has(result.status)) clearInterval(renewal) })
          .catch(() => clearInterval(renewal))
      }, this.renewalMs)
      unrefTimer(renewal)
      held.set(key, { leaseId: leaseId!, renewal, target: step.target })
    }
    if (step.operation === 'release' && active) {
      clearInterval(active.renewal)
      held.delete(key)
    }
  }

  private async releaseHeld (held: Map<string, HeldCommand>, ownerKey: string): Promise<void> {
    const releases = [...held.values()].map(async command => {
      clearInterval(command.renewal)
      await this.options.executor.execute({
        target: command.target,
        operation: 'release',
        leaseId: command.leaseId,
        timeoutMs: 10_000
      }, ownerKey, AbortSignal.timeout(10_000))
    })
    held.clear()
    await Promise.allSettled(releases)
  }
}

function stableTargetKey (target: ControlDeckCommandTarget): string {
  return `${target.adapterId}:${target.commandId}:${JSON.stringify(target.configuration, Object.keys(target.configuration).sort())}`
}

async function abortableWait (durationMs: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return }
    const timer = setTimeout(resolve, durationMs)
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason) }, { once: true })
  })
}

function unrefTimer (timer: ReturnType<typeof setInterval>): void {
  if (typeof timer !== 'object' || timer === null) return
  ;(timer as unknown as { unref?: () => void }).unref?.()
}
