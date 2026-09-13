import type { ExplorationTargetSearchRequest, ExplorationTargetSearchResult, ExplorationTargetSearchSource } from '../domain/exploration-target.js'
import type { SpanshSearchGateway } from './spansh-search-client.js'

const ELITE_RELEASED_AT = '2014-12-16T00:00:00.000Z'
const MAX_SIGNAL_COUNT = 100

export class SpanshExplorationTargetSource implements ExplorationTargetSearchSource {
  public constructor (private readonly spansh: SpanshSearchGateway) {}

  public async findTargets (request: ExplorationTargetSearchRequest): Promise<ExplorationTargetSearchResult[]> {
    const candidates = await this.spansh.search('bodies', {
      filters: providerFilters(request),
      referencePosition: request.referencePosition
    })
    return candidates.map(mapTarget).filter(isPresent)
  }
}

function providerFilters (request: ExplorationTargetSearchRequest): Record<string, unknown> {
  const filters: Record<string, unknown> = { distance: { min: 0, max: request.maxDistanceLy } }
  if (request.bodySubtypes.length > 0) filters.subtype = { value: request.bodySubtypes }
  if (request.atmospheres.length > 0) filters.atmosphere = { value: request.atmospheres }
  if (request.landable !== 'any') filters.is_landable = { value: request.landable === 'yes' }
  if (request.volcanismTypes.length > 0) filters.volcanism_type = { value: request.volcanismTypes }
  const gravity = range(request.minGravityG, request.maxGravityG)
  if (gravity) filters.gravity = gravity
  const temperature = range(request.minTemperatureK, request.maxTemperatureK)
  if (temperature) filters.surface_temperature = temperature
  const signals = [
    signalFilter('Biological', request.minBiologicalSignals),
    signalFilter('Geological', request.minGeologicalSignals)
  ].filter(isPresent)
  if (signals.length > 0) filters.signals = signals
  if (request.lastReportedBefore) {
    filters.updated_at = {
      comparison: '<=>',
      value: [ELITE_RELEASED_AT, `${request.lastReportedBefore}T23:59:59.999Z`]
    }
  }
  return filters
}

function signalFilter (name: string, minimum: number): { comparison: '<=>', count: [number, number], name: string } | null {
  return minimum > 0 ? { comparison: '<=>', count: [minimum, MAX_SIGNAL_COUNT], name } : null
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
