import type {
  FactionPresenceRequest,
  FactionPresenceResult,
  FactionPresenceSearchSource
} from '../domain/station-market.js'

const DEFAULT_BASE_URL = 'https://spansh.co.uk/api/'
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_RESULT_SIZE = 100

export interface SpanshFactionPresenceSourceOptions {
  baseUrl?: string
  fetch?: typeof fetch
  timeoutMs?: number
}

export class SpanshFactionPresenceSource implements FactionPresenceSearchSource {
  private readonly baseUrl: URL
  private readonly fetcher: typeof fetch
  private readonly timeoutMs: number

  public constructor (options: SpanshFactionPresenceSourceOptions = {}) {
    this.baseUrl = new URL(options.baseUrl ?? DEFAULT_BASE_URL)
    this.fetcher = options.fetch ?? globalThis.fetch
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  public async findFactionPresences (request: FactionPresenceRequest): Promise<FactionPresenceResult[]> {
    const response = await this.fetcher(new URL('systems/search', this.baseUrl), {
      body: JSON.stringify({
        filters: providerFilters(request),
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
    if (!raw || !Array.isArray(raw.results)) throw new Error('Spansh returned an unexpected faction-presence response.')
    return raw.results.flatMap(candidate => mapSystem(candidate, request))
  }
}

function providerFilters (request: FactionPresenceRequest): Record<string, unknown> {
  const presence: Record<string, unknown> = {
    influence: {
      comparison: '<=>',
      value: [request.minInfluencePercent / 100, 1]
    },
    name: { value: [request.factionName] }
  }
  if (request.allegiance) presence.allegiance = { value: [request.allegiance] }
  if (request.government) presence.government = { value: [request.government] }
  if (request.state) presence.state = { value: [request.state] }
  return {
    distance: { max: String(request.maxDistanceLy), min: '0' },
    minor_faction_presences: [presence]
  }
}

function mapSystem (candidate: unknown, request: FactionPresenceRequest): FactionPresenceResult[] {
  const raw = record(candidate)
  const systemName = stringValue(raw?.name)
  const distanceLy = nonnegativeNumber(raw?.distance)
  const x = finiteNumber(raw?.x)
  const y = finiteNumber(raw?.y)
  const z = finiteNumber(raw?.z)
  if (!raw || !systemName || distanceLy === null || x === null || y === null || z === null || !Array.isArray(raw.minor_faction_presences)) return []
  const controllingFaction = stringValue(raw.controlling_minor_faction)
  const presence = raw.minor_faction_presences
    .map(record)
    .find(candidate => stringValue(candidate?.name)?.toLocaleLowerCase() === request.factionName.toLocaleLowerCase())
  const factionName = stringValue(presence?.name)
  const influence = finiteNumber(presence?.influence)
  if (!presence || !factionName || influence === null || influence < 0 || influence > 1) return []
  const controlling = controllingFaction?.toLocaleLowerCase() === factionName.toLocaleLowerCase()
  if (request.controlling === 'yes' && !controlling) return []
  if (request.controlling === 'no' && controlling) return []
  return [{
    activeStates: stringArray(presence.active_states),
    allegiance: stringValue(presence.allegiance),
    controlling,
    distanceLy,
    factionName,
    government: stringValue(presence.government),
    influencePercent: influence * 100,
    pendingStates: stringArray(presence.pending_states),
    position: [x, y, z],
    recoveringStates: stringArray(presence.recovering_states),
    state: stringValue(presence.state),
    systemAddress: integerValue(raw.id64),
    systemName,
    updatedAt: isoString(raw.updated_at)
  }]
}

function record (candidate: unknown): Record<string, unknown> | null {
  return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : null
}

function stringValue (candidate: unknown): string | null {
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

function stringArray (candidate: unknown): string[] {
  return Array.isArray(candidate) ? candidate.map(stringValue).filter(isPresent) : []
}

function finiteNumber (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null
}

function nonnegativeNumber (candidate: unknown): number | null {
  const value = finiteNumber(candidate)
  return value !== null && value >= 0 ? value : null
}

function integerValue (candidate: unknown): number | null {
  if (typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0) return candidate
  if (typeof candidate === 'string' && /^\d+$/.test(candidate)) {
    const value = Number(candidate)
    return Number.isSafeInteger(value) ? value : null
  }
  return null
}

function isoString (candidate: unknown): string | null {
  const value = stringValue(candidate)
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null
}

function isPresent<T> (value: T | null): value is T {
  return value !== null
}
