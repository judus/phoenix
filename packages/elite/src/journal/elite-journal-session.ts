import type { EliteJournalEvent } from './elite-journal-file-source.js'

/** Continued.Part identifies the next header in the same running game session. */
export class EliteJournalSession {
  private nextPart: number | undefined
  private gameversion: string | undefined
  private build: string | undefined

  public isContinuation (event: EliteJournalEvent): boolean {
    return event.event === 'Fileheader' && this.nextPart !== undefined && event.part === this.nextPart &&
      this.gameversion !== undefined && event.gameversion === this.gameversion &&
      this.build !== undefined && event.build === this.build
  }

  public observe (event: EliteJournalEvent): boolean {
    const continuation = this.isContinuation(event)
    this.nextPart = undefined
    if (event.event === 'Fileheader') {
      this.gameversion = typeof event.gameversion === 'string' ? event.gameversion : undefined
      this.build = typeof event.build === 'string' ? event.build : undefined
    } else if (event.event === 'Continued' && Number.isSafeInteger(event.Part) && (event.Part as number) > 1) {
      this.nextPart = event.Part as number
    }
    return continuation
  }
}
