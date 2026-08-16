import type {
  OutfittingSearchRequest,
  OutfittingSearchResult,
  OutfittingSearchSource
} from '../domain/station-market.js'

const DEFAULT_BASE_URL = 'https://spansh.co.uk/api/'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_RESULT_SIZE = 100

export interface SpanshOutfittingSearchSourceOptions {
  baseUrl?: string
  fetch?: typeof fetch
  timeoutMs?: number
}

export class SpanshOutfittingSearchSource implements OutfittingSearchSource {
  private readonly baseUrl: URL
  private readonly fetcher: typeof fetch
  private readonly timeoutMs: number

  public constructor (options: SpanshOutfittingSearchSourceOptions = {}) {
    this.baseUrl = new URL(options.baseUrl ?? DEFAULT_BASE_URL)
    this.fetcher = options.fetch ?? globalThis.fetch
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  public async findOutfitting (request: OutfittingSearchRequest): Promise<OutfittingSearchResult[]> {
    const moduleFilter: Record<string, unknown> = { name: [request.moduleName] }
    if (request.moduleClass !== null) moduleFilter.class = [String(request.moduleClass)]
    if (request.moduleRating !== null) moduleFilter.rating = [request.moduleRating]
    const filters: Record<string, unknown> = {
      distance: { max: String(request.maxDistanceLy), min: 0 },
      modules: moduleFilter
    }
    if (request.minimumPadSize === 3) filters.has_large_pad = { value: true }

    const response = await this.fetcher(new URL('stations/search', this.baseUrl), {
      body: JSON.stringify({
        filters,
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
    if (!raw || !Array.isArray(raw.results)) throw new Error('Spansh returned an unexpected station-search response.')
    return raw.results.flatMap(candidate => mapStation(candidate, request))
  }
}

function mapStation (candidate: unknown, request: OutfittingSearchRequest): OutfittingSearchResult[] {
  const raw = record(candidate)
  const stationName = stringValue(raw?.name)
  const systemName = stringValue(raw?.system_name)
  const distanceLy = nonnegativeNumber(raw?.distance)
  const maxLandingPadSize = raw ? maximumPadSize(raw) : null
  if (!raw || !stationName || !systemName || distanceLy === null) return []
  if (distanceLy > request.maxDistanceLy) return []
  if (request.minimumPadSize !== null && (maxLandingPadSize === null || maxLandingPadSize < request.minimumPadSize)) return []

  return (Array.isArray(raw.modules) ? raw.modules : [])
    .map(record)
    .filter((module): module is Record<string, unknown> => module !== null && matchesModule(module, request))
    .map(module => ({
      category: stringValue(module.category),
      distanceLy,
      distanceToArrivalLs: nonnegativeNumber(raw.distance_to_arrival),
      marketId: integerValue(raw.market_id),
      maxLandingPadSize,
      moduleClass: integerValue(module.class),
      moduleName: stringValue(module.name)!,
      moduleRating: stringValue(module.rating),
      moduleSymbol: stringValue(module.ed_symbol),
      price: nonnegativeNumber(module.price),
      ship: stringValue(module.ship),
      stationName,
      stationType: stringValue(raw.type),
      systemName,
      updatedAt: isoString(raw.outfitting_updated_at)
    }))
}

function matchesModule (module: Record<string, unknown>, request: OutfittingSearchRequest): boolean {
  const name = stringValue(module.name)
  const moduleClass = integerValue(module.class)
  const rating = stringValue(module.rating)
  return sameName(name, request.moduleName) &&
    (request.moduleClass === null || moduleClass === request.moduleClass) &&
    (request.moduleRating === null || sameName(rating, request.moduleRating))
}

function maximumPadSize (raw: Record<string, unknown>): number | null {
  if (raw.has_large_pad === true || positiveNumber(raw.large_pads)) return 3
  if (positiveNumber(raw.medium_pads)) return 2
  if (positiveNumber(raw.small_pads)) return 1
  return null
}

function record (candidate: unknown): Record<string, unknown> | null {
  return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : null
}

function sameName (candidate: string | null, expected: string): boolean {
  return candidate?.localeCompare(expected, undefined, { sensitivity: 'base' }) === 0
}

function stringValue (candidate: unknown): string | null {
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

function isoString (candidate: unknown): string | null {
  const value = stringValue(candidate)
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null
}

function nonnegativeNumber (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 ? candidate : null
}

function integerValue (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0 ? candidate : null
}

function positiveNumber (candidate: unknown): boolean {
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0
}
