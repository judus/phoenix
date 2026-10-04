import type { EddnStatus } from '@phoenix/contracts'
import type { EliteJournalEvent, EliteJournalObservationSource } from '@phoenix/elite'
import { EddnMessageBuilder } from '../domain/eddn-message-builder.js'
import { EDDN_MAX_AGE_MS, type EddnMessage, type EddnMode, type EddnOutbox, type EddnTransport } from '../domain/eddn.js'
import type { SystemSettingsRepository } from '../domain/system-configuration.js'

interface Options {
  mode: EddnMode
  version: string
  outbox: EddnOutbox & { initialize(): void }
  settings: SystemSettingsRepository
  transport: EddnTransport
  valid(message: EddnMessage): boolean
  readSnapshot(event: EliteJournalEvent): Record<string, unknown> | undefined
  now?: () => number
}

export class EddnContributionService {
  private readonly builder: EddnMessageBuilder
  private readonly now: () => number
  private enabled = false
  private enabledSince = 0
  private error: string | null = null
  private ready = false
  private running = false
  private timer?: NodeJS.Timeout
  private inflight?: AbortController
  private pending?: Promise<void>

  public constructor (private readonly options: Options) {
    this.builder = new EddnMessageBuilder(options.version)
    this.now = options.now ?? Date.now
  }

  public start (): void {
    if (this.running) return
    this.running = true
    try {
      const preference = this.options.settings.loadOrCreate().community
      this.enabled = preference.eddnEnabled
      this.enabledSince = preference.eddnChangedAt
      this.options.outbox.initialize()
      this.options.outbox.prune(this.now())
      if (!this.enabled || this.options.mode === 'unavailable') this.options.outbox.clear()
      this.ready = true
      if (this.options.mode === 'test') {
        this.timer = setInterval(() => { void this.flush() }, 1000)
        this.timer.unref()
      }
    } catch {
      this.error = 'Contribution storage is unavailable. Check local storage and restart PHOENIX.'
    }
  }

  public async stop (): Promise<void> {
    this.running = false
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    this.inflight?.abort()
    await this.pending
  }

  public setEnabled (enabled: boolean): EddnStatus {
    const settings = this.options.settings.loadOrCreate()
    if (enabled === this.enabled) return this.status()
    this.options.settings.save({ ...settings, community: { eddnEnabled: enabled, eddnChangedAt: this.now() } })
    if (enabled !== this.enabled) {
      this.enabled = enabled
      this.enabledSince = this.now()
      this.inflight?.abort()
      try { if (this.ready) this.options.outbox.clear() } catch { this.storageFailure() }
    }
    return this.status()
  }

  public status (): EddnStatus {
    let storage = { queued: 0, lastSuccessAt: null as string | null }
    try { if (this.ready) storage = this.options.outbox.status() } catch { this.storageFailure() }
    return {
      enabled: this.enabled, mode: this.options.mode, ...storage, error: this.error,
      detail: !this.enabled ? 'Disabled. Pending uploads are cleared; already transmitted data cannot be recalled.'
        : this.options.mode === 'unavailable' ? 'Enabled by preference. Uploads are held until EDDN release review is complete.'
          : 'Test stream only. Live community publishing is not enabled in this build.'
    }
  }

  /** Called after normal projection. Contribution failures must never hold up cockpit ingestion. */
  public observe (event: EliteJournalEvent, source: EliteJournalObservationSource): void {
    try {
      this.builder.observe(event)
      if (!this.active() || source.replayed || Date.parse(event.timestamp) < this.enabledSince || !this.fresh(event.timestamp)) return
      let message: EddnMessage | undefined
      if (['Market', 'Outfitting', 'Shipyard'].includes(event.event)) {
        const snapshot = this.options.readSnapshot(event)
        if (snapshot) message = this.builder.stock(event, snapshot)
      } else if (['FSDJump', 'Location', 'Docked', 'Scan'].includes(event.event)) {
        message = this.builder.journal(event)
      } else return
      if (!message || !this.options.valid(message)) {
        this.error = 'An observation was skipped: incomplete context, mismatched snapshot or unsupported data.'
        return
      }
      this.options.outbox.enqueue(source.id, message, this.now())
    } catch {
      this.storageFailure()
    }
  }

  public flush (): Promise<void> {
    if (!this.pending) {
      this.pending = this.sendNext().finally(() => { this.pending = undefined })
    }
    return this.pending
  }

  private async sendNext (): Promise<void> {
    if (!this.active()) return
    try {
      this.options.outbox.prune(this.now())
      const next = this.options.outbox.next(this.now())
      if (!next) return
      if (!this.fresh(next.message.message.timestamp) || Date.parse(String(next.message.message.timestamp)) < this.enabledSince || !this.options.valid(next.message)) {
        this.options.outbox.discard(next.id)
        this.error = 'An expired or invalid queued observation was discarded.'
        return
      }
      const abort = new AbortController()
      this.inflight = abort
      let status = 0
      try { status = (await this.options.transport.send(next.message, abort.signal)).status } catch { /* Retry transport failures below. */ }
      if (!this.active() || abort.signal.aborted) return
      if (status >= 200 && status < 300) {
        this.options.outbox.acknowledge(next.id, this.now())
        this.error = null
      } else if (status === 0 || status === 408 || status === 429 || status >= 500) {
        const delay = Math.min(60 * 60 * 1000, 60_000 * 2 ** Math.min(next.attempts, 6))
        this.options.outbox.retry(next.id, this.now() + delay)
        this.error = 'EDDN is temporarily unavailable. Delivery will retry automatically.'
      } else {
        this.options.outbox.discard(next.id)
        this.error = `EDDN rejected an observation (HTTP ${status}). It will not be retried; check for a PHOENIX update.`
      }
    } catch {
      this.storageFailure()
    } finally {
      this.inflight = undefined
    }
  }

  private active (): boolean { return this.running && this.ready && this.enabled && this.options.mode === 'test' }
  private fresh (timestamp: unknown): boolean {
    const time = typeof timestamp === 'string' ? Date.parse(timestamp) : NaN
    return Number.isFinite(time) && time > this.now() - EDDN_MAX_AGE_MS && time <= this.now() + 5 * 60_000
  }
  private storageFailure (): void {
    this.error = 'Contribution could not process local data. Check local storage and restart PHOENIX if this persists.'
  }
}
