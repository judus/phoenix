import type { ExplorationTargetSearchRequest, ExplorationTargetSearchResult, ExplorationTargetSearchSource } from '../domain/exploration-target.js'

const DEFAULT_BASE_URL = 'https://spansh.co.uk/api/'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_RESULT_SIZE = 100

export interface SpanshExplorationTargetSourceOptions { baseUrl?: string, fetch?: typeof fetch, timeoutMs?: number }

export class SpanshExplorationTargetSource implements ExplorationTargetSearchSource {
  private readonly baseUrl: URL
  private readonly fetcher: typeof fetch
  private readonly timeoutMs: number

  public constructor (options: SpanshExplorationTargetSourceOptions = {}) {
    this.baseUrl = new URL(options.baseUrl ?? DEFAULT_BASE_URL)
    this.fetcher = options.fetch ?? globalThis.fetch
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  public async findTargets (request: ExplorationTargetSearchRequest): Promise<ExplorationTargetSearchResult[]> {
    const response = await this.fetcher(new URL('bodies/search', this.baseUrl), {
      body: JSON.stringify({
        filters: providerFilters(request),
        page: 0,
        reference_coords: { x: request.referencePosition[0], y: request.referencePosition[1], z: request.referencePosition[2] },
        size: DEFAULT_RESULT_SIZE,
        sort: [{ distance: { direction: 'asc' } }]
      }),
      headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'phoenix-terminal/0.1' },
      method: 'POST',
      signal: AbortSignal.timeout(this.timeoutMs)
    })
    if (!response.ok) throw new Error(`Spansh request failed with HTTP ${response.status}.`)
    const payload = record(await response.json())
    if (!payload || !Array.isArray(payload.results)) throw new Error('Spansh returned an unexpected body-search response.')
    return payload.results.map(mapTarget).filter(isPresent)
  }
}

function providerFilters (request: ExplorationTargetSearchRequest): Record<string, unknown> {
  const filters: Record<string, unknown> = { distance: { min: 0, max: request.maxDistanceLy } }
  if (request.bodyType) filters.subtype = { value: [request.bodyType] }
  if (request.atmosphere) filters.atmosphere = { value: [request.atmosphere] }
  if (request.landable !== 'any') filters.is_landable = { value: request.landable === 'yes' }
  if (request.volcanism) filters.volcanism_type = { value: [request.volcanism] }
  const gravity = range(request.minGravityG, request.maxGravityG)
  if (gravity) filters.gravity = gravity
  const temperature = range(request.minTemperatureK, request.maxTemperatureK)
  if (temperature) filters.surface_temperature = temperature
  return filters
}

function mapTarget (candidate: unknown): ExplorationTargetSearchResult | null {
  const raw = record(candidate)
  const bodyName = stringValue(raw?.name)
  const systemName = stringValue(raw?.system_name)
  const distanceLy = numberValue(raw?.distance)
  if (!raw || !bodyName || !systemName || distanceLy === null) return null
  const signals = Array.isArray(raw.signals) ? raw.signals.map(record).filter(isPresent) : []
  return {
    atmosphere: stringValue(raw.atmosphere),
    biologicalSignals: signalCount(signals, 'biological'),
    bodyId: integerValue(raw.body_id),
    bodyName,
    bodyType: stringValue(raw.type),
    distanceLy,
    distanceToArrivalLs: numberValue(raw.distance_to_arrival),
    geologicalSignals: signalCount(signals, 'geological'),
    gravityG: numberValue(raw.gravity),
    landable: typeof raw.is_landable === 'boolean' ? raw.is_landable : null,
    providerUpdatedAt: isoString(raw.updated_at),
    signalsUpdatedAt: isoString(raw.signals_updated_at),
    subtype: stringValue(raw.subtype),
    surfaceTemperatureK: numberValue(raw.surface_temperature),
    systemAddress: integerValue(raw.system_id64),
    systemName,
    volcanism: stringValue(raw.volcanism_type)
  }
}

function signalCount (signals: Record<string, unknown>[], name: string): number {
  const match = signals.find(signal => stringValue(signal.name)?.toLocaleLowerCase() === name)
  return integerValue(match?.count) ?? 0
}
function range (min: number | null, max: number | null): Record<string, number> | null { return min === null && max === null ? null : { ...(min === null ? {} : { min }), ...(max === null ? {} : { max }) } }
function record (value: unknown): Record<string, unknown> | null { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null }
function stringValue (value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null }
function numberValue (value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null }
function integerValue (value: unknown): number | null { const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value; return typeof number === 'number' && Number.isSafeInteger(number) && number >= 0 ? number : null }
function isoString (value: unknown): string | null { const string = stringValue(value); return string && Number.isFinite(Date.parse(string)) ? new Date(string).toISOString() : null }
function isPresent<T> (value: T | null): value is T { return value !== null }
