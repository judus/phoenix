import type { EliteJournalEvent, EliteJournalListener } from '@phoenix/elite'

export class EliteJournalProjectionPipeline {
  private pending?: { event: EliteJournalEvent, nextProjection: number }

  public constructor (private readonly projections: readonly EliteJournalListener[]) {}

  public async project (event: EliteJournalEvent): Promise<void> {
    if (this.pending && !sameEvent(this.pending.event, event)) {
      throw new Error('A different journal event arrived while projection retry was pending.')
    }

    const pending = this.pending ?? { event: structuredClone(event), nextProjection: 0 }
    this.pending = pending
    while (pending.nextProjection < this.projections.length) {
      await this.projections[pending.nextProjection]!(event)
      pending.nextProjection++
    }
    this.pending = undefined
  }
}

function sameEvent (left: EliteJournalEvent, right: EliteJournalEvent): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
