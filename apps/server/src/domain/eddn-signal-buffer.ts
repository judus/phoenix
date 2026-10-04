import type { EliteJournalEvent } from '@phoenix/elite'
import { eddnSignal } from './eddn-message-builder.js'
import { EDDN_MAX_MESSAGE_BYTES } from './eddn.js'

/** A contiguous journal run, not a timer window. Arrival can follow signals in Odyssey. */
export class EddnSignalBuffer {
  private events: EliteJournalEvent[] = []
  private firstId?: string
  private bytes = 0
  private overflow = false

  public add (event: EliteJournalEvent, id: string): boolean {
    const signal = eddnSignal(event)
    if (!signal) return true
    if (this.overflow) return false
    this.bytes += Buffer.byteLength(JSON.stringify(signal))
    if (this.bytes > EDDN_MAX_MESSAGE_BYTES - 2048) {
      this.events = []
      this.overflow = true
      return false
    }
    this.firstId ??= id
    this.events.push(signal)
    return true
  }

  public take (): { id: string, events: EliteJournalEvent[] } | undefined {
    const result = !this.overflow && this.firstId ? { id: `signals:${this.firstId}`, events: this.events } : undefined
    this.clear()
    return result
  }

  public clear (): void {
    this.events = []
    this.firstId = undefined
    this.bytes = 0
    this.overflow = false
  }
}
