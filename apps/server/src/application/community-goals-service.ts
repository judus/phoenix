import { CommunityGoalsSnapshotSchema, type CommunityGoalsResponse, type CommunityGoalsSnapshot } from '@phoenix/contracts'
import type { CommunityGoalsReader, CommunityGoalsSource } from '../domain/community-goals.js'
import type { ProviderResponseCache } from '../domain/station-market.js'
import { ProviderQueryCache } from './provider-query-cache.js'

const CACHE_AGE_MS = 15 * 60 * 1000

export class CommunityGoalsService implements CommunityGoalsReader {
  private readonly queries: ProviderQueryCache

  public constructor(
    private readonly source: CommunityGoalsSource,
    cache: ProviderResponseCache,
    private readonly now: () => Date = () => new Date()
  ) { this.queries = new ProviderQueryCache(cache, now) }

  public async getCurrent(): Promise<CommunityGoalsResponse> {
    const result = await this.queries.get('frontier-community-goals-v1', 'current', CACHE_AGE_MS,
      async () => ({ goals: await this.source.getCurrent(), fetchedAt: this.now().toISOString() }),
      (value): value is CommunityGoalsSnapshot =>
        CommunityGoalsSnapshotSchema.safeParse(value).success)
    return { ...result.value, cache: result.cache }
  }
}
