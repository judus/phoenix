export type ArmingListener = () => void

export class ArmingController {
  private armedElementId: string | null = null
  private expiryTimer: ReturnType<typeof globalThis.setTimeout> | undefined
  private readonly listeners = new Set<ArmingListener>()

  public readonly getSnapshot = (): string | null => this.armedElementId

  public readonly subscribe = (listener: ArmingListener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  public arm(elementId: string, armedForMs?: number): void {
    this.clearExpiry()
    this.armedElementId = elementId
    if (armedForMs !== undefined) {
      this.expiryTimer = globalThis.setTimeout(() => this.cancel(), armedForMs)
    }
    this.notify()
  }

  public cancel(): void {
    if (this.armedElementId === null && this.expiryTimer === undefined) return
    this.clearExpiry()
    this.armedElementId = null
    this.notify()
  }

  public confirm(elementId: string): boolean {
    if (this.armedElementId !== elementId) return false
    this.cancel()
    return true
  }

  private clearExpiry(): void {
    if (this.expiryTimer !== undefined) globalThis.clearTimeout(this.expiryTimer)
    this.expiryTimer = undefined
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}
