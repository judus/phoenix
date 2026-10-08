import { createHash } from 'node:crypto'
import { AiError } from '@jdu/llm-client'
import { GalnetAnalysisContentSchema, GalnetAnalysisSchema, type GalnetAnalysisResponse } from '@phoenix/contracts'
import type { GalnetArticleArchive } from '../domain/galnet.js'
import type { CommunityGoalsReader } from '../domain/community-goals.js'
import type { GalnetAnalysisReader, GalnetAnalysisRepository, GalnetArticleAnalyser } from '../domain/galnet-analysis.js'
import { createGalnetQuoteResolver } from './galnet-quote-resolver.js'
import { galnetStoryContext } from './galnet-story-context.js'
import { validateGalnetContinuity } from './galnet-continuity-validation.js'
import { galnetContextChanged } from './galnet-lead-reconciliation.js'

const EXTRACTOR_VERSION = 'galnet-analysis-v3'
const EvidenceSchema = GalnetAnalysisContentSchema.shape.facts.element.shape.evidence

export class GalnetAnalysisService implements GalnetAnalysisReader {
  private running?: { articleId: string, result: Promise<GalnetAnalysisResponse> }
  private readonly shutdown = new AbortController()

  public constructor (
    private readonly articles: Pick<GalnetArticleArchive, 'getArticle'>,
    private readonly goals: CommunityGoalsReader,
    private readonly repository: GalnetAnalysisRepository,
    private readonly analyser: GalnetArticleAnalyser,
    private readonly now: () => Date = () => new Date()
  ) {}

  public get (articleId: string): GalnetAnalysisResponse {
    const article = this.articles.getArticle(articleId)
    const analysis = this.repository.latest(articleId)
    return { configured: this.analyser.configured(), articleAvailable: article !== null,
      articleChanged: analysis !== null && article?.revisionId !== analysis.articleRevisionId,
      contextChanged: analysis !== null && galnetContextChanged(analysis, this.articles, this.repository), analysis }
  }

  public isBusy (): boolean { return this.running !== undefined }
  public configured (): boolean { return this.analyser.configured() }

  /** Read-only scheduling evidence; use exactly the context the next analysis would receive. */
  public contextRefreshes (): { articleId: string, evidenceKey: string }[] {
    // Parse the bounded report window once, not once per article on every worker/UI poll.
    const reports = this.repository.recent(100)
    const byId = new Map(reports.map(report => [report.articleId, report]))
    const reader = { recent: () => reports, latest: (id: string) => byId.get(id) ?? this.repository.latest(id) }
    return reports.sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt)).flatMap(report => {
      const article = this.articles.getArticle(report.articleId)
      if (!article || report.schemaVersion !== 3 || report.articleRevisionId !== article.revisionId) return []
      // Wait for corrected earlier articles, rather than removing their context temporarily
      // and spending another request when their corrected report arrives.
      if (report.context.some(source => this.articles.getArticle(source.articleId)?.revisionId !==
        reader.latest(source.articleId)?.articleRevisionId)) return []
      const context = galnetStoryContext(article, this.articles, reader)
      if (context.some(entry => galnetContextChanged(byId.get(entry.source.articleId)!, this.articles, reader))) return []
      const keys = context.map(entry => entry.source.analysisCacheKey)
      if (JSON.stringify(keys) === JSON.stringify(report.context.map(source => source.analysisCacheKey))) return []
      // Include the replaced report: returning to an earlier cached context must select it
      // again, but failed unchanged evidence must never retry itself.
      return [{ articleId: report.articleId,
        evidenceKey: createHash('sha256').update(JSON.stringify([report.cacheKey, keys])).digest('hex') }]
    })
  }

  public analyse (articleId: string): Promise<GalnetAnalysisResponse> {
    if (this.shutdown.signal.aborted) return Promise.reject(new AiError('cancelled', 'GalNet analysis is stopping.', { code: 'galnet_analysis_stopped' }))
    if (this.running) {
      if (this.running.articleId === articleId) return this.running.result
      return Promise.reject(new AiError('rate_limit', 'Another GalNet article is being analysed. Wait for it to finish.', { code: 'galnet_analysis_busy' }))
    }
    const result = this.run(articleId).finally(() => { this.running = undefined })
    this.running = { articleId, result }
    return result
  }

  public async stop (): Promise<void> {
    this.shutdown.abort()
    await this.running?.result.catch(() => undefined)
  }

  private async run (articleId: string): Promise<GalnetAnalysisResponse> {
    if (!this.analyser.configured()) throw new AiError('authentication', 'Configure an OpenAI API key in Settings before analysing GalNet.', { code: 'galnet_analysis_not_configured' })
    const article = this.articles.getArticle(articleId)
    if (!article) throw new AiError('invalid_request', 'This article has not been archived yet. Refresh the GalNet feed after its cache expires.', { code: 'galnet_article_unavailable' })
    const goals = await this.goals.getCurrent()
    this.shutdown.signal.throwIfAborted()
    // Ignore fetch time and cache-state changes, but not changed CG facts.
    const goalEvidence = [...goals.goals].sort((left, right) => left.id.localeCompare(right.id))
    const context = galnetStoryContext(article, this.articles, this.repository)
    const cacheKey = createHash('sha256').update(JSON.stringify({ revision: article.revisionId,
      model: this.analyser.model, extractor: EXTRACTOR_VERSION, goals: goalEvidence,
      context: context.map(entry => entry.source.analysisCacheKey) })).digest('hex')
    const cached = this.repository.get(cacheKey)
    if (cached) {
      this.repository.put(cached)
      return this.get(articleId)
    }
    if (JSON.stringify({ article: article.article, communityGoals: goals, ...(context.length > 0 ? { context } : {}) }).length > 60_000) {
      throw new AiError('invalid_request', 'The article, related coverage and Community Goals exceed the analysis input limit. No AI request was made.', { code: 'galnet_analysis_input_limit' })
    }
    const signal = AbortSignal.any([this.shutdown.signal, AbortSignal.timeout(90_000)])
    const result = await this.analyser.analyse(article, goals, signal, context)
    signal.throwIfAborted()
    const content = GalnetAnalysisContentSchema.parse(result.content)
    const resolveQuote = createGalnetQuoteResolver(article.article.title, article.article.body)
    const evidence = (quote: string, path: string, code = 'galnet_analysis_invalid_evidence'): string => {
      const source = resolveQuote(quote)
      if (source === undefined) throw new AiError('structured_output_validation',
        `Could not verify quote in ${path}: ${JSON.stringify(quote)}. Nothing was saved; no automatic retry was made.`, { code })
      if (!EvidenceSchema.safeParse(source).success) throw new AiError('structured_output_validation',
        `Source quote in ${path} exceeds the evidence length limit after restoring formatting: ${JSON.stringify(quote)}. Nothing was saved; no automatic retry was made.`, { code })
      return source
    }
    for (const group of ['facts', 'interpretations', 'entities', 'activities'] as const) {
      content[group].forEach((entry, index) => { entry.evidence = evidence(entry.evidence, `${group}[${index}].evidence`) })
    }
    for (const [index, activity] of content.activities.entries()) {
      const destination = activity.destination
      if (!destination) continue
      destination.evidence = evidence(destination.evidence, `activities[${index}].destination.evidence`, 'galnet_analysis_invalid_destination')
      if (!mentionsSystem(destination.evidence, destination.systemName) ||
        !content.entities.some(entity => entity.kind === 'system' && entity.name.toLowerCase() === destination.systemName.toLowerCase())) {
        throw new AiError('structured_output_validation', `Destination in activities[${index}] has no matching quoted system evidence: ${JSON.stringify(destination.systemName)}. Nothing was saved.`, { code: 'galnet_analysis_invalid_destination' })
      }
    }
    const linked = new Set<string>()
    for (const activity of content.activities) {
      const id = activity.communityGoalId
      if (id === null ? activity.relationship !== 'none'
        : activity.relationship === 'none' || !goals.goals.some(goal => goal.id === id) || linked.has(id)) {
        throw new AiError('structured_output_validation', 'Analysis contained an invalid or duplicate Community Goal reference. Nothing was saved.', { code: 'galnet_analysis_invalid_goal' })
      }
      if (id !== null) linked.add(id)
    }
    const continuity = validateGalnetContinuity(result.continuity, article, context, content, goals)
    const analysis = GalnetAnalysisSchema.parse({ schemaVersion: 3, extractorVersion: EXTRACTOR_VERSION,
      cacheKey, articleId, articleRevisionId: article.revisionId, sourceUrl: article.article.sourceUrl,
      publishedAt: article.article.publishedAt, analysedAt: this.now().toISOString(), model: this.analyser.model,
      communityGoals: goals, usage: result.usage, content, continuity, context: context.map(entry => entry.source) })
    this.repository.put(analysis)
    return this.get(articleId)
  }
}

function mentionsSystem(quote: string, name: string): boolean {
  const literal = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}\\p{M}_-])${literal}(?![\\p{L}\\p{N}\\p{M}_-])`, 'iu').test(quote)
}
