import { createHash, randomUUID } from 'node:crypto'
import { AiError } from '@jdu/llm-client'
import type { CommunityGoal, GalnetBackgroundJob, GalnetBackgroundSettings, GalnetBackgroundStatus } from '@phoenix/contracts'
import type { GalnetBackgroundRepository } from '../domain/galnet-background.js'
import type { GalnetArticleArchive, GalnetNewsReader } from '../domain/galnet.js'
import type { GalnetAnalysisReader, SavedGalnetAnalysisReader } from '../domain/galnet-analysis.js'
import type { CommunityGoalsReader } from '../domain/community-goals.js'

/** One installation worker. HTTP/UI reads never start inference. */
export class GalnetBackgroundService {
  private timer?: ReturnType<typeof setInterval>
  private running?: Promise<void>
  private stopped = false
  private lastPoll = 0
  private runtimeError?: string

  public constructor(
    private readonly repository: GalnetBackgroundRepository,
    private readonly news: GalnetNewsReader,
    private readonly goals: CommunityGoalsReader,
    private readonly archive: GalnetArticleArchive,
    private readonly reports: SavedGalnetAnalysisReader,
    private readonly analysis: GalnetAnalysisReader & { isBusy(): boolean, contextRefreshes(): { articleId: string, evidenceKey: string }[] },
    private readonly configured: () => boolean,
    private readonly now: () => Date = () => new Date()
  ) {}

  public start(): void {
    if (this.timer) return
    this.stopped = false
    this.timer = setInterval(() => { void this.tick() }, 5_000)
    this.timer.unref()
    void this.tick()
  }

  public async stop(): Promise<void> {
    this.stopped = true
    clearInterval(this.timer)
    this.timer = undefined
    await this.running
  }

  public status(): GalnetBackgroundStatus {
    const { goals: _goals, ...state } = this.repository.load()
    const queued = new Set(this.repository.activeArticleIds())
    const changedContext = new Set(this.analysis.contextRefreshes().map(refresh => refresh.articleId))
    const backlog = this.archive.recent(100).filter(({ article }) => {
      const saved = this.reports.get(article.id)
      return !queued.has(article.id) && (!saved || saved.articleChanged || saved.contextChanged || changedContext.has(article.id))
    }).map(({ article }) => ({ articleId: article.id, title: article.title, publishedAt: article.publishedAt }))
    return { ...state, sourceError: this.runtimeError ?? state.sourceError, configured: this.configured(), requestsToday: this.requestsToday(),
      pending: this.repository.pending(), jobs: this.repository.list(undefined, 20), backlog }
  }

  public setSettings(settings: GalnetBackgroundSettings): GalnetBackgroundStatus {
    this.repository.save({ ...this.repository.load(), ...settings })
    // The scheduler notices this on its next tick. A settings response is not a model request.
    return this.status()
  }

  public catchUp(articleIds: string[]): GalnetBackgroundStatus {
    if (!this.configured()) throw new AiError('authentication', 'Configure an OpenAI API key and restart PHOENIX before requesting catch-up.', { code: 'galnet_analysis_not_configured' })
    const articles = [...new Set(articleIds)].map(id => {
      const article = this.archive.getArticle(id)
      if (!article) throw new AiError('invalid_request', `Article ${id} is not archived. Refresh GalNet first.`, { code: 'galnet_article_unavailable' })
      return article
    })
    const pending = new Set(this.repository.activeArticleIds())
    const changedContext = new Set(this.analysis.contextRefreshes().map(refresh => refresh.articleId))
    const eligible = articles.filter(article => {
      const saved = this.reports.get(article.article.id)
      return !pending.has(article.article.id) && (!saved || saved.articleChanged || saved.contextChanged || changedContext.has(article.article.id))
    })
    if (this.repository.pending() + eligible.length > 100) throw new AiError('rate_limit', 'The GalNet queue is full. Let existing work finish before requesting more catch-up.', { code: 'galnet_background_queue_full' })
    // Explicit catch-up permits retrying failures, but not duplicate queued work or current reports.
    // Select the newest uncovered batch, but analyse it chronologically so later coverage can
    // use the earlier saved evidence without a second synthesis request.
    for (const article of eligible.sort((a, b) => Date.parse(a.article.publishedAt) - Date.parse(b.article.publishedAt))) {
      if (!this.enqueue(article.article.id, 'catch-up', randomUUID())) throw new AiError('rate_limit',
        'The GalNet queue is full. Let existing work finish before requesting more catch-up.', { code: 'galnet_background_queue_full' })
    }
    return this.status()
  }

  public tick(): Promise<void> {
    if (this.stopped) return Promise.resolve()
    return this.running ??= this.run().then(() => { this.runtimeError = undefined }).catch(cause => {
      // Storage may itself have failed. Keep diagnostics in memory, not another failing write.
      this.runtimeError = message(cause)
    }).finally(() => { this.running = undefined })
  }

  private async run(): Promise<void> {
    if (this.repository.load().enabled && this.now().getTime() - this.lastPoll >= 15 * 60_000) {
      this.lastPoll = this.now().getTime()
      try { await this.receive() } catch (cause) {
        this.repository.save({ ...this.repository.load(), sourceError: message(cause) })
      }
    }
    while (!this.stopped && this.configured() && !this.analysis.isBusy()) {
      const settings = this.repository.load()
      if (settings.enabled) this.queueContextRefreshes()
      if (this.requestsToday() >= settings.dailyLimit) break
      const job = this.repository.next(settings.enabled)
      if (!job) break
      if (this.archive.getArticle(job.articleId)?.revisionId !== job.articleRevisionId) {
        this.repository.put({ ...job, state: 'skipped', finishedAt: this.now().toISOString(), error: 'A newer article revision replaced this queued evidence.' })
        continue
      }
      const started = { ...job, state: 'running' as const, startedAt: this.now().toISOString() }
      this.repository.put(started)
      try {
        await this.analysis.analyse(job.articleId)
        this.repository.put({ ...started, state: 'succeeded', finishedAt: this.now().toISOString() })
      } catch (cause) {
        this.repository.put({ ...started, state: 'failed', finishedAt: this.now().toISOString(), error: message(cause) })
      }
    }
  }

  private queueContextRefreshes(): void {
    const pending = new Set(this.repository.activeArticleIds())
    for (const { articleId, evidenceKey } of this.analysis.contextRefreshes()) {
      if (pending.has(articleId)) continue
      // A full queue loses no observation: the next tick recomputes the same evidence key.
      this.enqueue(articleId, 'story-context', evidenceKey)
    }
  }

  private async receive(): Promise<void> {
    // Both readers can write their cache/archive. Join both, even if one fails, before shutdown
    // may close SQLite; Promise.all's early rejection would leave a writer running unowned.
    const results = await Promise.allSettled([this.news.getLatest(100), this.goals.getCurrent()])
    if (this.stopped) return
    const [newsResult, goalsResult] = results
    if (newsResult.status === 'rejected') throw newsResult.reason
    if (goalsResult.status === 'rejected') throw goalsResult.reason
    const news = newsResult.value
    const goals = goalsResult.value
    const state = this.repository.load()
    if (news.cache === 'stale' || goals.cache === 'stale') {
      this.repository.save({ ...state, sourceError: 'News or Community Goals are stale. No automatic work was queued.' })
      return
    }
    const goalKeys = Object.fromEntries(goals.goals.map(goal => [goal.id, goalKey(goal)]))
    let queueFull = false
    for (const article of [...news.articles].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt))) {
      const revision = this.archive.getArticle(article.id)!
      const previous = this.repository.observed(article.id)
      if (state.enabled && previous !== revision.revisionId &&
        (previous !== null || Date.parse(article.publishedAt) >= Date.parse(state.installedAt))) {
        if (!this.enqueue(article.id, 'article', revision.revisionId)) { queueFull = true; continue }
      }
      // Advance only after durable admission. A crash here replays the same idempotent job,
      // never loses work or retries a failed provider request.
      this.repository.observe(article.id, revision.revisionId)
    }
    // CG content changes matter; quantities/fetch times do not. Missing goals do not prove ending.
    if (state.lastCheckedAt !== null && state.enabled) {
      const changed = goals.goals.filter(goal => state.goals[goal.id] !== goalKeys[goal.id])
      const pending = new Set(this.repository.activeArticleIds())
      for (const saved of this.reports.recent(100).sort((a, b) => Date.parse(a.analysis.publishedAt) - Date.parse(b.analysis.publishedAt))) {
        if (saved.articleChanged) continue
        const related = changed.filter(goal => saved.analysis.content.activities.some(activity => activity.communityGoalId === goal.id) ||
          saved.analysis.content.entities.some(entity => entity.kind === 'system' && entity.name.toLowerCase() === goal.systemName.toLowerCase()))
        if (related.length > 0 && !pending.has(saved.analysis.articleId) &&
          !this.enqueue(saved.analysis.articleId, 'community-goal', hash(related.map(goal => goalKeys[goal.id]).sort()))) queueFull = true
      }
    }
    this.repository.save({ ...this.repository.load(), goals: queueFull ? state.goals : goalKeys,
      lastCheckedAt: this.now().toISOString(), sourceError: queueFull ? 'The GalNet queue is full. Unadmitted coverage will be checked again on a later poll.' : null })
  }

  private enqueue(articleId: string, reason: GalnetBackgroundJob['reason'], evidenceKey: string): boolean {
    const article = this.archive.getArticle(articleId)!
    return this.repository.enqueue({ id: hash([articleId, reason, article.revisionId, evidenceKey]),
      articleId, articleRevisionId: article.revisionId, title: article.article.title, reason, state: 'pending', queuedAt: this.now().toISOString(),
      startedAt: null, finishedAt: null, error: null })
  }

  private requestsToday(): number {
    return this.repository.requestsSince(`${this.now().toISOString().slice(0, 10)}T00:00:00.000Z`)
  }
}

function goalKey({ id, title, systemName, stationName, activityType, objective, targetCommodities, expiry, briefing }: CommunityGoal): string {
  return hash({ id, title, systemName, stationName, activityType, objective, targetCommodities, expiry, briefing })
}
function hash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex') }
function message(cause: unknown): string { return cause instanceof Error ? cause.message : 'GalNet background work failed.' }
