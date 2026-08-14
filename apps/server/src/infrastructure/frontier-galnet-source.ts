import { GalnetArticleSchema, type GalnetArticle } from '@phoenix/contracts'
import type { GalnetSource } from '../domain/galnet.js'

const DEFAULT_ENDPOINT = 'https://cms.zaonce.net/en-GB/jsonapi/node/galnet_article'

export class FrontierGalnetSource implements GalnetSource {
  public constructor (
    private readonly request: typeof fetch = fetch,
    private readonly endpoint = DEFAULT_ENDPOINT
  ) {}

  public async getLatest (limit: number): Promise<GalnetArticle[]> {
    const url = new URL(this.endpoint)
    url.searchParams.set('sort', '-published_at')
    url.searchParams.set('page[limit]', String(limit))
    const response = await this.request(url, { headers: { accept: 'application/vnd.api+json' } })
    if (!response.ok) throw new Error(`Frontier GalNet request failed (${response.status}).`)
    const document = await response.json() as unknown
    if (!isRecord(document) || !Array.isArray(document.data)) throw new Error('Frontier returned an invalid GalNet document.')
    return document.data.map(parseArticle)
  }
}

function parseArticle (candidate: unknown): GalnetArticle {
  if (!isRecord(candidate) || typeof candidate.id !== 'string' || !isRecord(candidate.attributes)) {
    throw new Error('Frontier returned an invalid GalNet article.')
  }
  const attributes = candidate.attributes
  const body = isRecord(attributes.body) && typeof attributes.body.value === 'string' ? attributes.body.value : ''
  return GalnetArticleSchema.parse({
    body,
    id: candidate.id,
    image: typeof attributes.field_galnet_image === 'string' ? attributes.field_galnet_image : null,
    publishedAt: attributes.published_at,
    title: attributes.title
  })
}

function isRecord (candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)
}
