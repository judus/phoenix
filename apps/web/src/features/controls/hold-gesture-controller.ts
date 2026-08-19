export type HoldGestureOperation = 'press' | 'release'
export type HoldGestureExecutor = (operation: HoldGestureOperation, leaseId: string) => Promise<unknown>

interface HeldGesture {
  execute: HoldGestureExecutor
  leaseId: string
  queue: Promise<unknown>
  renewal?: ReturnType<typeof setInterval>
}

export class HoldGestureController {
  private readonly gestures = new Map<string, HeldGesture>()

  public constructor (
    private readonly renewalMs = 5_000,
    private readonly createLeaseId: () => string = () => globalThis.crypto.randomUUID()
  ) {}

  public begin (actionId: string, execute: HoldGestureExecutor, renew = true): void {
    if (this.gestures.has(actionId)) return
    const gesture: HeldGesture = {
      execute,
      leaseId: this.createLeaseId(),
      queue: Promise.resolve()
    }
    this.gestures.set(actionId, gesture)
    this.enqueue(gesture, 'press')
    if (renew) gesture.renewal = setInterval(() => this.enqueue(gesture, 'press'), this.renewalMs)
  }

  public end (actionId: string): Promise<unknown> | undefined {
    const gesture = this.gestures.get(actionId)
    if (!gesture) return
    this.gestures.delete(actionId)
    return this.finish(gesture)
  }

  public async releaseAll (): Promise<void> {
    const releases = [...this.gestures.values()].map(gesture => this.finish(gesture))
    this.gestures.clear()
    await Promise.allSettled(releases)
  }

  private enqueue (gesture: HeldGesture, operation: HoldGestureOperation): void {
    gesture.queue = gesture.queue.finally(() => gesture.execute(operation, gesture.leaseId))
  }

  private finish (gesture: HeldGesture): Promise<unknown> {
    if (gesture.renewal) clearInterval(gesture.renewal)
    this.enqueue(gesture, 'release')
    return gesture.queue
  }
}
