import { ProviderQueryError } from '../domain/provider-query-error.js'
import { fetchProviderJson } from './fetch-provider-json.js'

const DEFAULT_BASE_URL = 'https://spansh.co.uk/api/'
const DEFAULT_TIMEOUT_MS = 30_000
export const SPANSH_SEARCH_CANDIDATE_LIMIT = 100

export type SpanshSearchIndex = 'bodies' | 'stations' | 'systems'

export interface SpanshSearchRequest {
  filters: Record<string, unknown>
  referencePosition: [number, number, number] | null
}

export interface SpanshSearchGateway {
  findFieldValues(index: SpanshSearchIndex, field: string, query: string): Promise<string[]>
  search(index: SpanshSearchIndex, request: SpanshSearchRequest): Promise<unknown[]>
}

export interface SpanshSearchClientOptions {
  baseUrl?: string
  fetch?: typeof fetch
  timeoutMs?: number
}

export class SpanshSearchClient implements SpanshSearchGateway {
  private readonly baseUrl: URL
  private readonly fetcher: typeof fetch
  private readonly timeoutMs: number

  public constructor (options: SpanshSearchClientOptions = {}) {
    this.baseUrl = new URL(options.baseUrl ?? DEFAULT_BASE_URL)
    this.fetcher = options.fetch ?? globalThis.fetch
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  public async findFieldValues (index: SpanshSearchIndex, field: string, query: string): Promise<string[]> {
    const url = new URL(`${index}/field_values/${encodeURIComponent(field)}`, this.baseUrl)
    url.searchParams.set('q', query)
    const payload = await fetchProviderJson('Spansh', this.fetcher, url, {
      headers: { accept: 'application/json', 'user-agent': 'phoenix-terminal/0.1' },
      signal: AbortSignal.timeout(this.timeoutMs)
    })
    const raw = record(payload)
    const values = index === 'stations' && (field === 'modules' || field === 'ships') ? record(raw?.values)?.name : raw?.values
    if (!Array.isArray(values)) throw new ProviderQueryError('Spansh', 'malformed_response')
    return [...new Set(values.map(stringValue).filter((value): value is string => value !== null))]
  }

  public async search (index: SpanshSearchIndex, request: SpanshSearchRequest): Promise<unknown[]> {
    const payload = await fetchProviderJson('Spansh', this.fetcher, new URL(`${index}/search`, this.baseUrl), {
      body: JSON.stringify({
        filters: request.filters,
        page: 0,
        ...(request.referencePosition ? { reference_coords: {
          x: request.referencePosition[0],
          y: request.referencePosition[1],
          z: request.referencePosition[2]
        } } : {}),
        size: SPANSH_SEARCH_CANDIDATE_LIMIT,
        ...(request.referencePosition ? { sort: [{ distance: { direction: 'asc' } }] } : {})
      }),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': 'phoenix-terminal/0.1'
      },
      method: 'POST',
      signal: AbortSignal.timeout(this.timeoutMs)
    })
    const raw = record(payload)
    if (!raw || !Array.isArray(raw.results)) throw new ProviderQueryError('Spansh', 'malformed_response')
    return raw.results
  }
}

function record (candidate: unknown): Record<string, unknown> | null {
  return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : null
}

function stringValue (candidate: unknown): string | null {
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}
