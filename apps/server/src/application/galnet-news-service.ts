import { GalnetArticleSchema, GalnetNewsResponseSchema, type GalnetArticle, type GalnetNewsResponse } from '@phoenix/contracts'
import type { GalnetArticleArchive, GalnetNewsReader, GalnetSource } from '../domain/galnet.js'
import type { ProviderResponseCache } from '../domain/station-market.js'

const CACHE_NAMESPACE = 'frontier-galnet'
const CACHE_KEY = 'latest'
const CACHE_AGE_MS = 15 * 60 * 1000

export class GalnetNewsService implements GalnetNewsReader {
  private refresh?: Promise<{ articles: GalnetArticle[], fetchedAt: string }>

  public constructor (
    private readonly source: GalnetSource,
    private readonly cache: ProviderResponseCache,
    private readonly archive: Pick<GalnetArticleArchive, 'observe'>,
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
      const { articles, fetchedAt } = await (this.refresh ??= this.fetchAndStore().finally(() => { this.refresh = undefined }))
      return response(articles.slice(0, limit), 'refreshed', fetchedAt)
    } catch (cause) {
      if (cached && cachedArticles) return response(cachedArticles.slice(0, limit), 'stale', cached.fetchedAt)
      throw cause
    }
  }

  private async fetchAndStore (): Promise<{ articles: GalnetArticle[], fetchedAt: string }> {
    const sourceArticles = await this.source.getLatest(100)
    const fetchedAt = this.now().toISOString()
    this.archive.observe(sourceArticles, fetchedAt)
    // Keep source/revision metadata internal; the latest-feed contract is unchanged.
    const articles = sourceArticles.map(({ body, id, image, publishedAt, title }) =>
      ({ body, id, image, publishedAt, title }))
    this.cache.putProviderResponse(CACHE_NAMESPACE, CACHE_KEY, fetchedAt, articles)
    return { articles, fetchedAt }
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
