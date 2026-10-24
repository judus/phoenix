import { AsyncLocalStorage } from 'node:async_hooks'
import type { GameActionCommand, GameActionResult } from '@phoenix/contracts'

interface Owner {
  label: string
  active: boolean
  controller: AbortController
  signal: AbortSignal
  done: Promise<void>
}

interface InputContext { owner?: Owner, admitted?: boolean }

export class GameInputBusyError extends Error {}

/** Coordinates complete PHOENIX operations; Control Deck still owns keys and leases. */
export class InputOperationCoordinator {
  private readonly context = new AsyncLocalStorage<InputContext>()
  private readonly holds = new Set<string>()
  private readonly inputs = new Map<symbol, { admitted: boolean, done: Promise<void> }>()
  private exclusiveOwner?: Owner
  private stopping = false

  public async exclusive<T> (label: string, work: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    const context = this.context.getStore()
    const current = context?.owner
    if (this.stopping || context?.admitted === false || (current && (!current.active || current.signal.aborted))) throw this.busy()
    if (current?.active && current === this.exclusiveOwner) {
      return work(signal ? AbortSignal.any([current.signal, signal]) : current.signal)
    }
    if (this.exclusiveOwner || this.holds.size || [...this.inputs.values()].some(input => input.admitted)) {
      throw this.busy()
    }
    signal?.throwIfAborted()
    const completion = pendingCompletion()
    const controller = new AbortController()
    const operationSignal = signal ? AbortSignal.any([controller.signal, signal]) : controller.signal
    const owner: Owner = { label, active: true, controller, signal: operationSignal, done: completion.promise }
    this.exclusiveOwner = owner
    try {
      return await this.context.run({ owner }, () => work(operationSignal))
    } finally {
      owner.active = false
      this.exclusiveOwner = undefined
      completion.resolve()
    }
  }

  public async input<T> (operation: GameActionCommand['operation'], work: () => Promise<T>): Promise<T> {
    const owner = this.context.getStore()?.owner
    const admitted = operation === 'release' || this.canDispatch(owner)
    const id = Symbol('input')
    const completion = pendingCompletion()
    this.inputs.set(id, { admitted, done: completion.promise })
    try {
      // Capture admission before Control Deck queues a lease transition. Cached results
      // remain the runtime's responsibility; a new blocked dispatch stays blocked.
      return await this.context.run({ owner, admitted }, work)
    } finally {
      this.inputs.delete(id)
      completion.resolve()
    }
  }

  public assertDispatch (operation: GameActionCommand['operation']): void {
    if (operation === 'release') return
    const context = this.context.getStore()
    if (context?.admitted === false || !this.canDispatch(context?.owner)) throw this.busy()
  }

  public dispatched (command: GameActionCommand, result: GameActionResult): void {
    if (result.status !== 'accepted' || !command.leaseId || command.operation === 'tap') return
    const key = JSON.stringify([command.origin, command.leaseId])
    if (command.operation === 'press') this.holds.add(key)
    else this.holds.delete(key)
  }

  public async stop (): Promise<void> {
    this.stopping = true
    const owner = this.exclusiveOwner
    owner?.controller.abort(new DOMException('PHOENIX input is stopping.', 'AbortError'))
    await owner?.done
    while (this.inputs.size) await Promise.all([...this.inputs.values()].map(input => input.done))
  }

  private canDispatch (owner?: Owner): boolean {
    return !this.stopping && (!owner || (owner.active && !owner.signal.aborted)) && (!this.exclusiveOwner || this.exclusiveOwner === owner)
  }

  private busy (): GameInputBusyError {
    const reason = this.stopping ? 'PHOENIX is stopping' : this.exclusiveOwner?.label ?? (this.holds.size ? 'held game controls' : 'pending game input')
    return new GameInputBusyError(`Game input is busy with ${reason}. No new input was sent; try again after it finishes.`)
  }
}

function pendingCompletion (): { promise: Promise<void>, resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>(accept => { resolve = accept })
  return { promise, resolve }
}
