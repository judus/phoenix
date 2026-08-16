import type {
  StationLocationType,
  StationLookupRequest,
  StationLookupResult,
  StationLookupSource
} from '../domain/station-market.js'

const DEFAULT_BASE_URL = 'https://spansh.co.uk/api/'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_RESULT_SIZE = 100
const ORBITAL_TYPES = [
  'Asteroid Base',
  'Coriolis Starport',
  'Dodec Starport',
  'Dockable Planet Station',
  'Mega Ship',
  'Ocellus Starport',
  'Orbis Starport',
  'Outpost',
  'Space Construction Depot'
]
const SURFACE_TYPES = [
  'Planetary Construction Depot',
  'Planetary Outpost',
  'Planetary Port',
  'Settlement'
]

export interface SpanshStationLookupSourceOptions {
  baseUrl?: string
  fetch?: typeof fetch
  timeoutMs?: number
}

export class SpanshStationLookupSource implements StationLookupSource {
  private readonly baseUrl: URL
  private readonly fetcher: typeof fetch
  private readonly timeoutMs: number

  public constructor (options: SpanshStationLookupSourceOptions = {}) {
    this.baseUrl = new URL(options.baseUrl ?? DEFAULT_BASE_URL)
    this.fetcher = options.fetch ?? globalThis.fetch
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  public async findStations (request: StationLookupRequest): Promise<StationLookupResult[]> {
    const names = await this.findCandidateNames(request.name)
    if (names.length === 0) return []
    const filters: Record<string, unknown> = {
      distance: { max: String(request.maxDistanceLy), min: 0 },
      name: { value: names }
    }
    const stationTypes = providerTypes(request.stationType)
    if (stationTypes) filters.type = { value: stationTypes }
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

  private async findCandidateNames (query: string): Promise<string[]> {
    const url = new URL('stations/field_values/name', this.baseUrl)
    url.searchParams.set('q', query)
    const response = await this.fetcher(url, {
      headers: { accept: 'application/json', 'user-agent': 'phoenix-terminal/0.1' },
      signal: AbortSignal.timeout(this.timeoutMs)
    })
    if (!response.ok) throw new Error(`Spansh station-name lookup failed with HTTP ${response.status}.`)
    const payload: unknown = await response.json()
    const raw = record(payload)
    if (!raw || !Array.isArray(raw.values)) throw new Error('Spansh returned an unexpected station-name response.')
    return [...new Set(raw.values.map(stringValue).filter((value): value is string => value !== null))]
  }
}

function mapStation (candidate: unknown, request: StationLookupRequest): StationLookupResult[] {
  const raw = record(candidate)
  const stationName = stringValue(raw?.name)
  const systemName = stringValue(raw?.system_name)
  const distanceLy = nonnegativeNumber(raw?.distance)
  const maxLandingPadSize = raw ? maximumPadSize(raw) : null
  if (!raw || !stationName || !systemName || distanceLy === null) return []
  if (!stationName.toLocaleLowerCase().includes(request.name.toLocaleLowerCase())) return []
  if (distanceLy > request.maxDistanceLy) return []
  if (request.minimumPadSize !== null && (maxLandingPadSize === null || maxLandingPadSize < request.minimumPadSize)) return []
  if (!matchesStationType(raw, request.stationType)) return []
  return [{
    allegiance: stringValue(raw.allegiance),
    controllingFaction: stringValue(raw.controlling_minor_faction),
    distanceLy,
    distanceToArrivalLs: nonnegativeNumber(raw.distance_to_arrival),
    government: stringValue(raw.government),
    marketId: integerValue(raw.market_id),
    maxLandingPadSize,
    primaryEconomy: stringValue(raw.primary_economy),
    secondaryEconomy: stringValue(raw.secondary_economy),
    services: names(raw.services),
    stationName,
    stationType: stringValue(raw.type),
    systemName,
    updatedAt: isoString(raw.updated_at)
  }]
}

function providerTypes (stationType: StationLocationType): string[] | null {
  if (stationType === 'carrier') return ['Drake-Class Carrier']
  if (stationType === 'orbital') return ORBITAL_TYPES
  if (stationType === 'surface') return SURFACE_TYPES
  return null
}

function matchesStationType (raw: Record<string, unknown>, stationType: StationLocationType): boolean {
  if (stationType === 'any') return true
  const type = stringValue(raw.type)
  if (stationType === 'carrier') return type === 'Drake-Class Carrier'
  if (stationType === 'surface') return raw.is_planetary === true || (type !== null && SURFACE_TYPES.includes(type))
  return raw.is_planetary === false && type !== 'Drake-Class Carrier'
}

function names (candidate: unknown): string[] {
  if (!Array.isArray(candidate)) return []
  return [...new Set(candidate.map(record).map(item => stringValue(item?.name)).filter((value): value is string => value !== null))]
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
  if (typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0) return candidate
  if (typeof candidate === 'string' && /^\d+$/.test(candidate)) {
    const value = Number(candidate)
    return Number.isSafeInteger(value) ? value : null
  }
  return null
}

function positiveNumber (candidate: unknown): boolean {
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0
}
