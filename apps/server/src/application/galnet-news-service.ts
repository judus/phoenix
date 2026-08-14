import { GalnetArticleSchema, GalnetNewsResponseSchema, type GalnetArticle, type GalnetNewsResponse } from '@phoenix/contracts'
import type { GalnetNewsReader, GalnetSource } from '../domain/galnet.js'
import type { ProviderResponseCache } from '../domain/station-market.js'

const CACHE_NAMESPACE = 'frontier-galnet'
const CACHE_KEY = 'latest'
const CACHE_AGE_MS = 15 * 60 * 1000

export class GalnetNewsService implements GalnetNewsReader {
  private refresh?: Promise<GalnetArticle[]>

  public constructor (
    private readonly source: GalnetSource,
    private readonly cache: ProviderResponseCache,
    private readonly now: () => Date = () => new Date()
  ) {}

  public async getLatest (requestedLimit = 40): Promise<GalnetNewsResponse> {
    const limit = Math.max(1, Math.min(100, Math.trunc(requestedLimit)))
    const cached = this.cache.getProviderResponse(CACHE_NAMESPACE, CACHE_KEY)
    const cachedArticles = parseCached(cached?.value)
    if (cached && cachedArticles && this.now().getTime() - Date.parse(cached.fetchedAt) <= CACHE_AGE_MS) {
      return response(cachedArticles.slice(0, limit), 'fresh', cached.fetchedAt)
    }
    try {
      const articles = await (this.refresh ??= this.source.getLatest(100).finally(() => { this.refresh = undefined }))
      const fetchedAt = this.now().toISOString()
      this.cache.putProviderResponse(CACHE_NAMESPACE, CACHE_KEY, fetchedAt, articles)
      return response(articles.slice(0, limit), 'refreshed', fetchedAt)
    } catch (cause) {
      if (cached && cachedArticles) return response(cachedArticles.slice(0, limit), 'stale', cached.fetchedAt)
      throw cause
    }
  }
}

function parseCached (candidate: unknown): GalnetArticle[] | null {
  if (!Array.isArray(candidate)) return null
  const result = candidate.map(article => GalnetArticleSchema.safeParse(article))
  return result.every(entry => entry.success) ? result.map(entry => entry.data) : null
}

function response (
  articles: GalnetArticle[],
  cache: GalnetNewsResponse['cache'],
  fetchedAt: string
): GalnetNewsResponse {
  return GalnetNewsResponseSchema.parse({ articles, cache, fetchedAt })
}
