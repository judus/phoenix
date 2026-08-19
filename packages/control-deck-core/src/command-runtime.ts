export type CommandOperation = 'tap' | 'press' | 'release'

export type CommandRuntimeResultStatus =
  | 'already_satisfied'
  | 'accepted'
  | 'confirmed'
  | 'unconfirmed'
  | 'rejected'
  | 'cancelled'
  | 'timed_out'
  | 'failed'

export interface CommandRuntimeRequest<Payload> {
  correlationId: string
  idempotencyKey?: string
  leaseId?: string
  operation: CommandOperation
  ownerKey: string
  payload: Payload
  requestId: string
  targetKey: string
  timeoutMs?: number
}

export interface CommandRuntimeResult {
  status: CommandRuntimeResultStatus
}

export interface CommandExecutionAdapter<Payload, Result extends CommandRuntimeResult> {
  createExpiredRelease(request: CommandRuntimeRequest<Payload>): CommandRuntimeRequest<Payload>
  createResult(
    request: CommandRuntimeRequest<Payload>,
    status: 'accepted' | 'rejected',
    message: string
  ): Result
  execute(request: CommandRuntimeRequest<Payload>, signal: AbortSignal): Promise<Result>
}

interface ActiveLease<Payload> {
  request: CommandRuntimeRequest<Payload>
  timer: ReturnType<typeof setTimeout>
}

export class CommandExecutionRuntime<Payload, Result extends CommandRuntimeResult> {
  private readonly idempotentRequests = new Map<string, { fingerprint: string, result: Promise<Result> }>()
  private readonly activeLeases = new Map<string, ActiveLease<Payload>>()
  private readonly closedLeases = new Set<string>()
  private readonly leaseQueues = new Map<string, Promise<unknown>>()

  public constructor (
    private readonly adapter: CommandExecutionAdapter<Payload, Result>,
    private readonly maximumHoldMs = 15_000
  ) {}

  public execute (request: CommandRuntimeRequest<Payload>, callerSignal?: AbortSignal): Promise<Result> {
    if (request.operation !== 'tap' && !request.leaseId) {
      return Promise.resolve(this.adapter.createResult(request, 'rejected', 'Hold actions require a lease ID.'))
    }
    const fingerprint = `${request.ownerKey}:${request.targetKey}:${request.operation}:${request.leaseId ?? ''}`
    const cacheKey = request.idempotencyKey === undefined
      ? undefined
      : `${request.ownerKey}:${request.idempotencyKey}`
    const cached = cacheKey === undefined ? undefined : this.idempotentRequests.get(cacheKey)
    if (cached) {
      return cached.fingerprint === fingerprint
        ? cached.result
        : Promise.resolve(this.adapter.createResult(
            request,
            'rejected',
            'The idempotency key was already used for a different action.'
          ))
    }

    const execution = request.leaseId && request.operation !== 'tap'
      ? this.enqueueLeaseTransition(request, callerSignal)
      : this.executeCommand(request, callerSignal)
    if (cacheKey !== undefined) {
      this.idempotentRequests.set(cacheKey, { fingerprint, result: execution })
      if (this.idempotentRequests.size > 1_000) {
        this.idempotentRequests.delete(this.idempotentRequests.keys().next().value as string)
      }
    }
    return execution
  }

  public async stop (): Promise<void> {
    await Promise.all([...this.activeLeases.keys()].map(leaseId => this.expireLease(leaseId)))
  }

  private enqueueLeaseTransition (
    request: CommandRuntimeRequest<Payload>,
    callerSignal?: AbortSignal
  ): Promise<Result> {
    const leaseId = request.leaseId!
    const previous = this.leaseQueues.get(leaseId) ?? Promise.resolve()
    const execution = previous
      .catch(() => undefined)
      .then(() => this.executeLeaseTransition(request, callerSignal))
    this.leaseQueues.set(leaseId, execution)
    const cleanQueue = () => {
      if (this.leaseQueues.get(leaseId) === execution) this.leaseQueues.delete(leaseId)
    }
    void execution.then(cleanQueue, cleanQueue)
    return execution
  }

  private async executeLeaseTransition (
    request: CommandRuntimeRequest<Payload>,
    callerSignal?: AbortSignal
  ): Promise<Result> {
    const leaseId = request.leaseId!
    const lease = this.activeLeases.get(leaseId)
    if (request.operation === 'press') {
      if (this.closedLeases.has(leaseId)) {
        return this.adapter.createResult(request, 'rejected', 'This hold lease is already closed.')
      }
      if (lease) {
        if (!sameLeaseOwner(lease.request, request)) {
          return this.adapter.createResult(
            request,
            'rejected',
            'This hold lease belongs to a different target or owner.'
          )
        }
        clearTimeout(lease.timer)
        this.activeLeases.set(leaseId, {
          ...lease,
          timer: this.scheduleExpiry(leaseId, this.maximumHoldMs)
        })
        return this.adapter.createResult(request, 'accepted', 'Hold lease renewed.')
      }
    }
    if (request.operation === 'release') {
      if (!lease) {
        this.closeLease(leaseId)
        return this.adapter.createResult(request, 'rejected', 'This hold lease is not active.')
      }
      if (!sameLeaseOwner(lease.request, request)) {
        return this.adapter.createResult(
          request,
          'rejected',
          'This hold lease belongs to a different target or owner.'
        )
      }
    }

    const result = await this.executeCommand(request, callerSignal)
    if (result.status !== 'accepted') return result
    if (request.operation === 'press') {
      this.activeLeases.set(leaseId, {
        request,
        timer: this.scheduleExpiry(leaseId, this.maximumHoldMs)
      })
    } else {
      clearTimeout(lease!.timer)
      this.activeLeases.delete(leaseId)
      this.closeLease(leaseId)
    }
    return result
  }

  private scheduleExpiry (leaseId: string, delayMs: number): ReturnType<typeof setTimeout> {
    const timer = setTimeout(() => {
      void this.expireLease(leaseId).catch(() => {
        const lease = this.activeLeases.get(leaseId)
        if (lease) this.activeLeases.set(leaseId, { ...lease, timer: this.scheduleExpiry(leaseId, 1_000) })
      })
    }, delayMs)
    unrefTimer(timer)
    return timer
  }

  private async expireLease (leaseId: string): Promise<void> {
    const lease = this.activeLeases.get(leaseId)
    if (!lease) return
    const request = this.adapter.createExpiredRelease(lease.request)
    const result = await this.enqueueLeaseTransition(request)
    if (result.status !== 'accepted' && this.activeLeases.has(leaseId)) {
      clearTimeout(lease.timer)
      this.activeLeases.set(leaseId, { ...lease, timer: this.scheduleExpiry(leaseId, 1_000) })
    }
  }

  private closeLease (leaseId: string): void {
    this.closedLeases.add(leaseId)
    if (this.closedLeases.size > 1_000) {
      this.closedLeases.delete(this.closedLeases.values().next().value as string)
    }
  }

  private executeCommand (request: CommandRuntimeRequest<Payload>, callerSignal?: AbortSignal): Promise<Result> {
    const timeout = AbortSignal.timeout(request.timeoutMs ?? 5_000)
    const signal = callerSignal === undefined ? timeout : AbortSignal.any([callerSignal, timeout])
    return this.adapter.execute(request, signal)
  }
}

function sameLeaseOwner<Payload> (
  left: CommandRuntimeRequest<Payload>,
  right: CommandRuntimeRequest<Payload>
): boolean {
  return left.targetKey === right.targetKey && left.ownerKey === right.ownerKey
}

function unrefTimer (timer: ReturnType<typeof setTimeout>): void {
  if (typeof timer !== 'object' || timer === null) return
  const candidate = timer as unknown as { unref?: () => void }
  candidate.unref?.()
}
