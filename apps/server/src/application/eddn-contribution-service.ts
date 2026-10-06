import type { EddnStatus, EddnSubmissionDetail, EddnSubmissionLog, EliteGameStatus } from '@phoenix/contracts'
import type { EliteJournalEvent, EliteJournalObservationSource } from '@phoenix/elite'
import { EddnMessageBuilder, EDDN_JOURNAL_EVENTS, EDDN_SNAPSHOT_EVENTS } from '../domain/eddn-message-builder.js'
import { EddnSignalBuffer } from '../domain/eddn-signal-buffer.js'
import { EDDN_MAX_AGE_MS, EDDN_REQUEST_TIMEOUT_MS, EddnQueueCapacityError, type EddnMessage, type EddnMode, type EddnOutbox, type EddnTransport } from '../domain/eddn.js'
import type { SystemSettingsRepository } from '../domain/system-configuration.js'

interface Options {
  mode: EddnMode
  version: string
  outbox: EddnOutbox & { initialize(): void }
  settings: SystemSettingsRepository
  transport: EddnTransport
  valid(message: unknown): message is EddnMessage
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
  private readonly signals = new EddnSignalBuffer()
  private readonly snapshots = new Map<string, { content: string, at: number }>()

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
      if (!this.enabled || this.options.mode === 'unavailable') this.options.outbox.clear(this.now())
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
    // Only flush against already established context, never infer a missing arrival on shutdown.
    if (this.active()) this.flushSignals()
    this.running = false
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    this.inflight?.abort()
    await this.pending
  }

  public setEnabled (enabled: boolean): EddnStatus {
    const settings = this.options.settings.loadOrCreate()
    if (enabled === this.enabled) return this.status()
    const changedAt = this.now()
    this.options.settings.save({ ...settings, community: { eddnEnabled: enabled, eddnChangedAt: changedAt } })
    this.enabled = enabled
    this.enabledSince = changedAt
    this.signals.clear()
    this.snapshots.clear()
    this.inflight?.abort()
    try { if (this.ready) this.options.outbox.clear(this.now()) } catch { this.storageFailure() }
    return this.status()
  }

  public status (): EddnStatus {
    let storage: Pick<EddnStatus, 'queued' | 'lastSuccessAt' | 'losses'> = { queued: 0, lastSuccessAt: null, losses: [] }
    try { if (this.ready) storage = this.options.outbox.status() } catch { this.storageFailure() }
    return {
      enabled: this.enabled, mode: this.options.mode, ...storage, error: this.error,
      detail: !this.enabled ? 'Disabled. Pending uploads are cleared; already transmitted data cannot be recalled.'
        : this.options.mode === 'unavailable' ? 'Enabled by preference. Uploads are held until EDDN release review is complete.'
          : 'Test stream only; EDMC parity is incomplete. Keep your existing uploader. Live community publishing is not enabled.'
    }
  }

  public submissionLog (): EddnSubmissionLog {
    return { status: this.status(), entries: this.ready ? this.options.outbox.submissions(this.now()) : [] }
  }

  public submission (id: number): EddnSubmissionDetail | undefined {
    return this.ready ? this.options.outbox.submission(id, this.now()) : undefined
  }

  /** Called after normal projection. Contribution failures must never hold up cockpit ingestion. */
  public observe (event: EliteJournalEvent, source: EliteJournalObservationSource): void {
    try {
      const reset = ['Fileheader', 'LoadGame', 'JoinACrew', 'QuitACrew'].includes(event.event) ||
        (event.event === 'Music' && event.MusicTrack === 'MainMenu')
      if (reset || source.replayed || !this.active()) {
        this.signals.clear()
        this.snapshots.clear()
      }
      const arrival = ['FSDJump', 'CarrierJump', 'Location'].includes(event.event)
      // Flush with the incoming location for Odyssey, or the previous location for other events.
      if (!arrival && event.event !== 'FSSSignalDiscovered') this.flushSignals()
      this.builder.observe(event)
      if (arrival) this.flushSignals()
      if (!this.active() || source.replayed || Date.parse(event.timestamp) < this.enabledSince || !this.fresh(event.timestamp)) return
      if (!this.builder.canContribute()) return
      if (event.event === 'FSSSignalDiscovered') {
        if (!this.signals.add(event, source.id)) this.error = 'A signal batch exceeded the safety limit and was skipped.'
        return
      }
      let message: EddnMessage | undefined
      if (EDDN_SNAPSHOT_EVENTS.has(event.event)) {
        const snapshot = this.options.readSnapshot(event)
        if (snapshot) message = this.builder.snapshot(event, snapshot)
      } else if (EDDN_JOURNAL_EVENTS.has(event.event)) {
        message = this.builder.journal(event)
      } else return
      if (!message || !this.options.valid(message)) {
        this.error = 'An observation was skipped: incomplete context, mismatched snapshot or unsupported data.'
        return
      }
      if (EDDN_SNAPSHOT_EVENTS.has(event.event) && event.event !== 'NavRoute') {
        const { timestamp: _, ...data } = message.message
        const content = JSON.stringify(data)
        const previous = this.snapshots.get(message.$schemaRef)
        if (previous?.content === content && this.now() - previous.at < EDDN_MAX_AGE_MS) return
        this.options.outbox.enqueue(source.id, message, this.now())
        this.snapshots.set(message.$schemaRef, { content, at: this.now() })
      } else this.options.outbox.enqueue(source.id, message, this.now())
    } catch (cause) {
      this.storageFailure(cause)
    }
  }

  public observeStatus (status: Pick<EliteGameStatus, 'timestamp' | 'bodyName'>): void {
    this.builder.observeStatus(status)
  }

  private flushSignals (): void {
    const batch = this.signals.take()
    if (!batch || !this.active()) return
    try {
      const eligible = batch.events.filter(event => this.fresh(event.timestamp) && Date.parse(event.timestamp) >= this.enabledSince)
      const message = this.builder.signals(eligible)
      if (!message) return // Mission-only or wrong-system run: no public observation to submit.
      if (!this.options.valid(message)) {
        this.error = 'A signal batch was skipped: invalid or oversized observation.'
        return
      }
      this.options.outbox.enqueue(batch.id, message, this.now())
    } catch (cause) { this.storageFailure(cause) }
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
      if (!this.options.valid(next.message)) {
        this.options.outbox.drop(next.id, 'invalid', this.now())
        this.error = 'An invalid queued observation was discarded.'
        return
      }
      if (!this.fresh(next.message.message.timestamp) || Date.parse(String(next.message.message.timestamp)) < this.enabledSince) {
        const timestamp = Date.parse(String(next.message.message.timestamp))
        this.options.outbox.drop(next.id, Number.isFinite(timestamp) && timestamp <= this.now() ? 'expired' : 'invalid', this.now())
        this.error = 'An expired or invalid queued observation was discarded.'
        return
      }
      const abort = new AbortController()
      this.inflight = abort
      // Reserve a retry deadline before I/O: a crash or shutdown must not cause an immediate resend.
      const attempt = this.options.outbox.beginAttempt(next.id, this.now() + EDDN_REQUEST_TIMEOUT_MS + 60_000, this.now())
      let status = 0
      try { status = (await this.options.transport.send(next.message, abort.signal)).status } catch { /* Retry transport failures below. */ }
      if (!this.active() || abort.signal.aborted) {
        this.options.outbox.finishAttempt(attempt, 'interrupted', status || null, this.now())
        return
      }
      if (status >= 200 && status < 300) {
        // Preserve remote acceptance even if removing the local queue entry subsequently fails.
        this.options.outbox.finishAttempt(attempt, 'accepted', status, this.now())
        this.options.outbox.acknowledge(next.id, this.now())
        this.error = null
      } else if (status === 0 || status === 408 || status === 429 || status >= 500) {
        const delay = Math.min(60 * 60 * 1000, 60_000 * 2 ** Math.min(next.attempts, 6))
        const retryAt = this.now() + delay
        this.options.outbox.finishAttempt(attempt, 'retry', status || null, this.now(), retryAt)
        this.options.outbox.retry(next.id, retryAt)
        this.error = 'EDDN is temporarily unavailable. Delivery will retry automatically.'
      } else {
        this.snapshots.delete(next.message.$schemaRef)
        this.options.outbox.finishAttempt(attempt, 'rejected', status, this.now())
        this.options.outbox.drop(next.id, 'rejected', this.now())
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
  private storageFailure (cause?: unknown): void {
    this.error = cause instanceof EddnQueueCapacityError ? cause.message
      : 'Contribution could not process local data. Check local storage and restart PHOENIX if this persists.'
  }
}
