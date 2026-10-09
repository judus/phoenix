import { AtlasPoiDocumentSchema, type AtlasCatalogueResponse, type AtlasPoi, type AtlasPoiDocument } from '@phoenix/contracts'
import type { AtlasCatalogueReader, AtlasPoiSource } from '../domain/atlas.js'
import type { ProviderResponseCache } from '../domain/station-market.js'
import { ProviderQueryCache } from './provider-query-cache.js'

const CACHE_AGE_MS = 24 * 60 * 60 * 1000

export class AtlasCatalogueService implements AtlasCatalogueReader {
  private readonly queries: ProviderQueryCache

  public constructor(
    private readonly sources: AtlasPoiSource[],
    private readonly cache: ProviderResponseCache,
    now: () => Date = () => new Date(),
    private readonly knownSites: AtlasPoi[] = []
  ) { this.queries = new ProviderQueryCache(cache, now) }

  public async getCatalogue(): Promise<AtlasCatalogueResponse> {
    const results = await Promise.all(this.sources.map(source => this.getSource(source)))
    return { pois: [...this.knownSites, ...results.flatMap(result => result.pois)], sources: results.map(result => result.status) }
  }

  private async getSource(source: AtlasPoiSource): Promise<AtlasPoiSourceResult> {
    const namespace = `atlas-pois-v1:${source.id}`
    const status = { name: source.name, url: source.url, licence: source.licence }
    try {
      const result = await this.queries.get(namespace, 'all', CACHE_AGE_MS, () => source.getPois(), isPoiDocument)
      // A successful cache read/refresh has persisted the validated document and its timestamp.
      const fetchedAt = this.cache.getProviderResponse(namespace, 'all')!.fetchedAt
      return { pois: result.value.pois, status: { ...status, cache: result.cache, fetchedAt, rejected: result.value.rejected,
        error: result.cache === 'stale' ? 'Refresh failed.' : null } }
    } catch (cause) {
      return { pois: [], status: { ...status, cache: 'unavailable', fetchedAt: null, rejected: 0,
        error: cause instanceof Error ? cause.message : 'Catalogue lookup failed.' } }
    }
  }
}

type AtlasPoiSourceResult = { pois: AtlasCatalogueResponse['pois'], status: AtlasCatalogueResponse['sources'][number] }

function isPoiDocument(candidate: unknown): candidate is AtlasPoiDocument {
  const parsed = AtlasPoiDocumentSchema.safeParse(candidate)
  return parsed.success && parsed.data.pois.length > 0
}
