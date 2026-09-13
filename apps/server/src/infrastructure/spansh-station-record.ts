export interface SpanshStationRecord {
  distanceLy: number
  distanceToArrivalLs: number | null
  marketId: number | null
  maxLandingPadSize: number | null
  raw: Record<string, unknown>
  stationName: string
  stationType: string | null
  systemName: string
}

export function spanshStationRecord (candidate: unknown): SpanshStationRecord | null {
  const raw = spanshRecord(candidate)
  const stationName = spanshString(raw?.name)
  const systemName = spanshString(raw?.system_name)
  const distanceLy = spanshNonnegativeNumber(raw?.distance)
  if (!raw || !stationName || !systemName || distanceLy === null) return null
  return {
    distanceLy,
    distanceToArrivalLs: spanshNonnegativeNumber(raw.distance_to_arrival),
    marketId: spanshInteger(raw.market_id),
    maxLandingPadSize: maximumPadSize(raw),
    raw,
    stationName,
    stationType: spanshString(raw.type),
    systemName
  }
}

export function spanshRecord (candidate: unknown): Record<string, unknown> | null {
  return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as Record<string, unknown>
    : null
}

export function spanshRecords (candidate: unknown): Array<Record<string, unknown>> {
  return Array.isArray(candidate) ? candidate.map(spanshRecord).filter(isPresent) : []
}

export function spanshString (candidate: unknown): string | null {
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null
}

export function spanshIsoString (candidate: unknown): string | null {
  const value = spanshString(candidate)
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null
}

export function spanshNonnegativeNumber (candidate: unknown): number | null {
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 ? candidate : null
}

export function spanshInteger (candidate: unknown): number | null {
  if (typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0) return candidate
  if (typeof candidate === 'string' && /^\d+$/.test(candidate)) {
    const value = Number(candidate)
    return Number.isSafeInteger(value) ? value : null
  }
  return null
}

export function spanshNames (candidate: unknown): string[] {
  return [...new Set(spanshRecords(candidate).map(item => spanshString(item.name)).filter(isPresent))]
}

export function sameSpanshName (candidate: string | null, expected: string): boolean {
  return candidate?.localeCompare(expected, undefined, { sensitivity: 'base' }) === 0
}

function maximumPadSize (raw: Record<string, unknown>): number | null {
  if (raw.has_large_pad === true || positiveNumber(raw.large_pads)) return 3
  if (positiveNumber(raw.medium_pads)) return 2
  if (positiveNumber(raw.small_pads)) return 1
  return null
}

function positiveNumber (candidate: unknown): boolean {
  return typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0
}

function isPresent<T> (value: T | null): value is T {
  return value !== null
}
