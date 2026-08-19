import { z } from 'zod'
import {
  CommandExecutionRuntime,
  type CommandExecutionAdapter,
  type CommandRuntimeRequest
} from './command-runtime.js'

const AdapterIdSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u)
const CommandIdSchema = z.string().regex(/^[A-Za-z][A-Za-z0-9_.:-]*$/u)
const JsonObjectSchema = z.record(z.string(), z.json())

export const ControlDeckCommandOperationSchema = z.enum(['tap', 'press', 'release'])
export const ControlDeckCommandResultStatusSchema = z.enum([
  'already_satisfied',
  'accepted',
  'confirmed',
  'unconfirmed',
  'rejected',
  'cancelled',
  'timed_out',
  'failed'
])

export const ControlDeckCommandTargetSchema = z.object({
  adapterId: AdapterIdSchema,
  commandId: CommandIdSchema,
  configuration: JsonObjectSchema
})

export const ExecuteControlDeckCommandRequestSchema = z.object({
  target: ControlDeckCommandTargetSchema,
  operation: ControlDeckCommandOperationSchema.default('tap'),
  leaseId: z.string().min(1).max(200).optional(),
  requestId: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  timeoutMs: z.number().int().min(1).max(30_000).optional()
})

export const ControlDeckAdapterCommandSchema = z.object({
  id: CommandIdSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  available: z.boolean(),
  unavailableReason: z.string().min(1).nullable(),
  risk: z.enum(['safe', 'caution', 'dangerous', 'destructive']),
  simulated: z.boolean(),
  operations: z.array(ControlDeckCommandOperationSchema).min(1),
  configurationSchema: JsonObjectSchema
})

export const ControlDeckAdapterDescriptorSchema = z.object({
  id: AdapterIdSchema,
  version: z.string().min(1),
  label: z.string().min(1),
  available: z.boolean(),
  simulated: z.boolean(),
  detail: z.string().min(1),
  platformRequirements: z.array(z.string().min(1)),
  holdOwner: z.enum(['control-deck', 'adapter']),
  commands: z.array(ControlDeckAdapterCommandSchema)
})

export const ControlDeckCommandCatalogueSchema = z.object({
  adapters: z.array(ControlDeckAdapterDescriptorSchema)
})

export const ControlDeckCommandExecutionResultSchema = z.object({
  requestId: z.string().min(1),
  correlationId: z.string().min(1),
  target: ControlDeckCommandTargetSchema,
  operation: ControlDeckCommandOperationSchema,
  ownerKey: z.string().min(1),
  status: ControlDeckCommandResultStatusSchema,
  timestamp: z.iso.datetime(),
  message: z.string().min(1),
  simulated: z.boolean(),
  data: z.json().optional()
})

export type ControlDeckCommandOperation = z.infer<typeof ControlDeckCommandOperationSchema>
export type ControlDeckCommandTarget = z.infer<typeof ControlDeckCommandTargetSchema>
export type ExecuteControlDeckCommandRequest = z.infer<typeof ExecuteControlDeckCommandRequestSchema>
export type ControlDeckAdapterCommand = z.infer<typeof ControlDeckAdapterCommandSchema>
export type ControlDeckAdapterDescriptor = z.infer<typeof ControlDeckAdapterDescriptorSchema>
export type ControlDeckCommandCatalogue = z.infer<typeof ControlDeckCommandCatalogueSchema>
export type ControlDeckCommandExecutionResult = z.infer<typeof ControlDeckCommandExecutionResultSchema>

export interface ControlDeckAdapterExecutionResult {
  data?: z.infer<ReturnType<typeof z.json>>
  message: string
  simulated?: boolean
  status: z.infer<typeof ControlDeckCommandResultStatusSchema>
}

export interface ControlDeckCommandInvocation {
  correlationId: string
  idempotencyKey?: string
  leaseId?: string
  operation: ControlDeckCommandOperation
  ownerKey: string
  requestId: string
  target: ControlDeckCommandTarget
  timeoutMs?: number
}

export interface ControlDeckCommandAdapter {
  describe(): ControlDeckAdapterDescriptor
  execute(
    invocation: ControlDeckCommandInvocation,
    signal: AbortSignal
  ): Promise<ControlDeckAdapterExecutionResult>
  start?(): Promise<void> | void
  stop?(): Promise<void> | void
  validate(target: ControlDeckCommandTarget): string | null
}

export interface ControlDeckCommandServiceOptions {
  createId: () => string
  maximumHoldMs?: number
  now?: () => number
}

interface ResolvedCommand {
  adapter: ControlDeckCommandAdapter
  target: ControlDeckCommandTarget
}

export class ControlDeckCommandService {
  private readonly adapters: Map<string, ControlDeckCommandAdapter>
  private readonly createId: () => string
  private readonly now: () => number
  private readonly executionAdapter: RegisteredCommandExecutionAdapter
  private readonly runtime: CommandExecutionRuntime<ResolvedCommand, ControlDeckCommandExecutionResult>
  private readonly startedAdapters: ControlDeckCommandAdapter[] = []

  public constructor (adapters: readonly ControlDeckCommandAdapter[], options: ControlDeckCommandServiceOptions) {
    this.adapters = new Map(adapters.map(adapter => {
      const descriptor = ControlDeckAdapterDescriptorSchema.parse(adapter.describe())
      return [descriptor.id, adapter]
    }))
    if (this.adapters.size !== adapters.length) throw new Error('Control Deck adapter IDs must be unique.')
    this.createId = options.createId
    this.now = options.now ?? Date.now
    this.executionAdapter = new RegisteredCommandExecutionAdapter(this.createId, this.now)
    this.runtime = new CommandExecutionRuntime(this.executionAdapter, options.maximumHoldMs)
  }

  public getCatalogue (): ControlDeckCommandCatalogue {
    return ControlDeckCommandCatalogueSchema.parse({
      adapters: [...this.adapters.values()].map(adapter => adapter.describe())
    })
  }

  public async start (): Promise<void> {
    if (this.startedAdapters.length > 0) return
    try {
      for (const adapter of this.adapters.values()) {
        await adapter.start?.()
        this.startedAdapters.push(adapter)
      }
    } catch (cause) {
      try {
        await this.stopAdapters()
      } catch (cleanupCause) {
        throw new AggregateError([cause, cleanupCause], 'Control Deck adapter startup and rollback failed.')
      }
      throw cause
    }
  }

  public async stop (): Promise<void> {
    let runtimeFailure: unknown
    try {
      await this.runtime.stop()
    } catch (cause) {
      runtimeFailure = cause
    }
    try {
      await this.stopAdapters()
    } catch (adapterFailure) {
      if (runtimeFailure !== undefined) {
        throw new AggregateError([runtimeFailure, adapterFailure], 'Control Deck command shutdown failed.')
      }
      throw adapterFailure
    }
    if (runtimeFailure !== undefined) throw runtimeFailure
  }

  public execute (
    candidate: unknown,
    ownerKey: string,
    signal?: AbortSignal
  ): Promise<ControlDeckCommandExecutionResult> {
    if (ownerKey.trim() === '') throw new Error('Control Deck command owner is required.')
    const request = ExecuteControlDeckCommandRequestSchema.parse(candidate)
    const requestId = request.requestId ?? this.createId()
    const correlationId = request.correlationId ?? requestId
    const adapter = this.adapters.get(request.target.adapterId)
    if (!adapter) return Promise.resolve(this.result(
      request,
      ownerKey,
      requestId,
      correlationId,
      'rejected',
      `Unknown command adapter: ${request.target.adapterId}.`,
      false
    ))
    const descriptor = ControlDeckAdapterDescriptorSchema.parse(adapter.describe())
    if (!descriptor.available) return Promise.resolve(this.result(
      request,
      ownerKey,
      requestId,
      correlationId,
      'rejected',
      descriptor.detail,
      descriptor.simulated
    ))
    const command = descriptor.commands.find(candidate => candidate.id === request.target.commandId)
    if (!command) return Promise.resolve(this.result(
      request,
      ownerKey,
      requestId,
      correlationId,
      'rejected',
      `Unknown ${descriptor.label} command: ${request.target.commandId}.`,
      descriptor.simulated
    ))
    if (!command.available) return Promise.resolve(this.result(
      request,
      ownerKey,
      requestId,
      correlationId,
      'rejected',
      command.unavailableReason ?? `${command.label} is unavailable.`,
      command.simulated
    ))
    if (!command.operations.includes(request.operation)) return Promise.resolve(this.result(
      request,
      ownerKey,
      requestId,
      correlationId,
      'rejected',
      `${command.label} does not support ${request.operation}.`,
      command.simulated
    ))
    const validationError = adapter.validate(request.target)
    if (validationError) return Promise.resolve(this.result(
      request,
      ownerKey,
      requestId,
      correlationId,
      'rejected',
      validationError,
      command.simulated
    ))
    if (request.operation !== 'tap' && !request.leaseId) return Promise.resolve(this.result(
      request,
      ownerKey,
      requestId,
      correlationId,
      'rejected',
      'Hold actions require a lease ID.',
      command.simulated
    ))

    const runtimeRequest: CommandRuntimeRequest<ResolvedCommand> = {
      correlationId,
      ...(request.idempotencyKey ? { idempotencyKey: request.idempotencyKey } : {}),
      ...(request.leaseId ? { leaseId: request.leaseId } : {}),
      operation: request.operation,
      ownerKey,
      payload: { adapter, target: request.target },
      requestId,
      targetKey: stableTargetKey(request.target),
      ...(request.timeoutMs ? { timeoutMs: request.timeoutMs } : {})
    }
    if (descriptor.holdOwner === 'adapter' && runtimeRequest.operation !== 'tap') {
      const timeout = AbortSignal.timeout(runtimeRequest.timeoutMs ?? 5_000)
      const executionSignal = signal === undefined ? timeout : AbortSignal.any([signal, timeout])
      return this.executionAdapter.execute(runtimeRequest, executionSignal)
    }
    return this.runtime.execute(runtimeRequest, signal)
  }

  private result (
    request: ExecuteControlDeckCommandRequest,
    ownerKey: string,
    requestId: string,
    correlationId: string,
    status: ControlDeckCommandExecutionResult['status'],
    message: string,
    simulated: boolean
  ): ControlDeckCommandExecutionResult {
    return ControlDeckCommandExecutionResultSchema.parse({
      requestId,
      correlationId,
      target: request.target,
      operation: request.operation,
      ownerKey,
      status,
      timestamp: new Date(this.now()).toISOString(),
      message,
      simulated
    })
  }

  private async stopAdapters (): Promise<void> {
    const failures: unknown[] = []
    for (const adapter of this.startedAdapters.splice(0).reverse()) {
      try {
        await adapter.stop?.()
      } catch (cause) {
        failures.push(cause)
      }
    }
    if (failures.length > 0) throw new AggregateError(failures, 'Control Deck adapter shutdown failed.')
  }
}

class RegisteredCommandExecutionAdapter implements CommandExecutionAdapter<ResolvedCommand, ControlDeckCommandExecutionResult> {
  public constructor (private readonly createId: () => string, private readonly now: () => number) {}

  public createExpiredRelease (
    request: CommandRuntimeRequest<ResolvedCommand>
  ): CommandRuntimeRequest<ResolvedCommand> {
    const requestId = this.createId()
    return { ...request, correlationId: requestId, operation: 'release', requestId }
  }

  public createResult (
    request: CommandRuntimeRequest<ResolvedCommand>,
    status: 'accepted' | 'rejected',
    message: string
  ): ControlDeckCommandExecutionResult {
    return this.result(request, status, message)
  }

  public async execute (
    request: CommandRuntimeRequest<ResolvedCommand>,
    signal: AbortSignal
  ): Promise<ControlDeckCommandExecutionResult> {
    const result = await request.payload.adapter.execute(invocationFrom(request), signal)
    return this.result(request, result.status, result.message, result.simulated, result.data)
  }

  private result (
    request: CommandRuntimeRequest<ResolvedCommand>,
    status: ControlDeckCommandExecutionResult['status'],
    message: string,
    simulated = request.payload.adapter.describe().simulated,
    data?: z.infer<ReturnType<typeof z.json>>
  ): ControlDeckCommandExecutionResult {
    return ControlDeckCommandExecutionResultSchema.parse({
      requestId: request.requestId,
      correlationId: request.correlationId,
      target: request.payload.target,
      operation: request.operation,
      ownerKey: request.ownerKey,
      status,
      timestamp: new Date(this.now()).toISOString(),
      message,
      simulated,
      ...(data === undefined ? {} : { data })
    })
  }
}

function invocationFrom (request: CommandRuntimeRequest<ResolvedCommand>): ControlDeckCommandInvocation {
  return {
    correlationId: request.correlationId,
    ...(request.idempotencyKey ? { idempotencyKey: request.idempotencyKey } : {}),
    ...(request.leaseId ? { leaseId: request.leaseId } : {}),
    operation: request.operation,
    ownerKey: request.ownerKey,
    requestId: request.requestId,
    target: request.payload.target,
    ...(request.timeoutMs ? { timeoutMs: request.timeoutMs } : {})
  }
}

function stableTargetKey (target: ControlDeckCommandTarget): string {
  return `${target.adapterId}:${target.commandId}:${stableJson(target.configuration)}`
}

function stableJson (value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`).join(',')}}`
  }
  return JSON.stringify(value)
}
