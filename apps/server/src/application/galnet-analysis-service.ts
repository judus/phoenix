import { createHash } from 'node:crypto'
import { AiError } from '@jdu/llm-client'
import { GalnetAnalysisContentSchema, GalnetAnalysisSchema, type GalnetAnalysisResponse } from '@phoenix/contracts'
import type { GalnetArticleArchive } from '../domain/galnet.js'
import type { CommunityGoalsReader } from '../domain/community-goals.js'
import type { GalnetAnalysisReader, GalnetAnalysisRepository, GalnetArticleAnalyser } from '../domain/galnet-analysis.js'

const EXTRACTOR_VERSION = 'galnet-analysis-v1'

export class GalnetAnalysisService implements GalnetAnalysisReader {
  private running?: { articleId: string, result: Promise<GalnetAnalysisResponse> }
  private readonly shutdown = new AbortController()

  public constructor (
    private readonly articles: GalnetArticleArchive,
    private readonly goals: CommunityGoalsReader,
    private readonly repository: GalnetAnalysisRepository,
    private readonly analyser: GalnetArticleAnalyser,
    private readonly now: () => Date = () => new Date()
  ) {}

  public get (articleId: string): GalnetAnalysisResponse {
    const article = this.articles.getArticle(articleId)
    const analysis = this.repository.latest(articleId)
    return { configured: this.analyser.configured(), articleAvailable: article !== null,
      articleChanged: analysis !== null && article?.revisionId !== analysis.articleRevisionId, analysis }
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
    const cacheKey = createHash('sha256').update(JSON.stringify({ revision: article.revisionId,
      model: this.analyser.model, extractor: EXTRACTOR_VERSION, goals: goalEvidence })).digest('hex')
    const cached = this.repository.get(cacheKey)
    if (cached) return { ...this.get(articleId), analysis: cached,
      articleChanged: this.articles.getArticle(articleId)?.revisionId !== cached.articleRevisionId }
    if (JSON.stringify({ article: article.article, communityGoals: goals }).length > 60_000) {
      throw new AiError('invalid_request', 'The article and Community Goals exceed the analysis input limit. No AI request was made.', { code: 'galnet_analysis_input_limit' })
    }
    const signal = AbortSignal.any([this.shutdown.signal, AbortSignal.timeout(90_000)])
    const result = await this.analyser.analyse(article, goals, signal)
    signal.throwIfAborted()
    const content = GalnetAnalysisContentSchema.parse(result.content)
    const quoteExists = (quote: string) => article.article.body.includes(quote) || article.article.title.includes(quote)
    const quotes = [...content.facts, ...content.interpretations, ...content.entities, ...content.activities]
    if (quotes.some(entry => !quoteExists(entry.evidence))) {
      throw new AiError('structured_output_validation', 'Analysis contained a quote not found in the article. Nothing was saved.', { code: 'galnet_analysis_invalid_evidence' })
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
    const analysis = GalnetAnalysisSchema.parse({ schemaVersion: 1, extractorVersion: EXTRACTOR_VERSION,
      cacheKey, articleId, articleRevisionId: article.revisionId, sourceUrl: article.article.sourceUrl,
      publishedAt: article.article.publishedAt, analysedAt: this.now().toISOString(), model: this.analyser.model,
      communityGoals: goals, usage: result.usage, content })
    this.repository.put(analysis)
    return this.get(articleId)
  }
}
