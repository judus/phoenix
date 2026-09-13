const DEFAULT_BASE_URL = 'https://spansh.co.uk/api/'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_RESULT_SIZE = 100

export type SpanshSearchIndex = 'bodies' | 'stations' | 'systems'

export interface SpanshSearchRequest {
  filters: Record<string, unknown>
  referencePosition: [number, number, number]
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
    const response = await this.fetcher(url, {
      headers: { accept: 'application/json', 'user-agent': 'phoenix-terminal/0.1' },
      signal: AbortSignal.timeout(this.timeoutMs)
    })
    if (!response.ok) throw new Error(`Spansh field-value lookup failed with HTTP ${response.status}.`)
    const payload: unknown = await response.json()
    const raw = record(payload)
    if (!raw || !Array.isArray(raw.values)) throw new Error('Spansh returned an unexpected field-value response.')
    return [...new Set(raw.values.map(stringValue).filter((value): value is string => value !== null))]
  }

  public async search (index: SpanshSearchIndex, request: SpanshSearchRequest): Promise<unknown[]> {
    const response = await this.fetcher(new URL(`${index}/search`, this.baseUrl), {
      body: JSON.stringify({
        filters: request.filters,
        page: 0,
        reference_coords: {
          x: request.referencePosition[0],
          y: request.referencePosition[1],
          z: request.referencePosition[2]
        },
        size: DEFAULT_RESULT_SIZE,
        sort: [{ distance: { direction: 'asc' } }]
      }),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'user-agent': 'phoenix-terminal/0.1'
      },
      method: 'POST',
      signal: AbortSignal.timeout(this.timeoutMs)
    })
    if (!response.ok) throw new Error(`Spansh request failed with HTTP ${response.status}.`)
    const payload: unknown = await response.json()
    const raw = record(payload)
    if (!raw || !Array.isArray(raw.results)) throw new Error(`Spansh returned an unexpected ${index} search response.`)
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
