import { SPANSH_SEARCH_CANDIDATE_LIMIT, type SpanshSearchGateway, type SpanshSearchRequest } from './spansh-search-client.js'
import { spanshInteger, spanshNonnegativeNumber, spanshRecords, spanshStationRecord, spanshString } from './spansh-station-record.js'

/** Search each suitable pad class before Spansh applies its nearest-candidate limit. */
export async function searchSpanshStations (
  spansh: SpanshSearchGateway,
  request: SpanshSearchRequest,
  minimumPadSize: number | null
): Promise<unknown[]> {
  if (minimumPadSize === null) return spansh.search('stations', request)
  const padFilters: Record<string, unknown>[] = [{ has_large_pad: { value: true } }]
  if (minimumPadSize <= 2) padFilters.push({ medium_pads: { comparison: '>=', value: 1 } })
  if (minimumPadSize <= 1) padFilters.push({ small_pads: { comparison: '>=', value: 1 } })
  // At most three bounded requests. Each branch returns its nearest 100 eligible stations,
  // so their union contains the nearest 100 stations across every suitable pad class.
  const batches = await Promise.all(padFilters.map(filters => spansh.search('stations', {
    ...request,
    filters: { ...request.filters, ...filters }
  })))
  const stations = new Map<string, Record<string, unknown>>()
  for (const candidate of batches.flat()) {
    const station = spanshStationRecord(candidate, true)
    if (!station || (request.referencePosition !== null && station.distanceLy === null)) continue
    if (station.maxLandingPadSize === null || station.maxLandingPadSize < minimumPadSize) continue
    const raw = station.raw
    const marketId = spanshInteger(raw.market_id)
    const id = spanshString(raw.id) ?? spanshInteger(raw.id)?.toString()
    const identity = marketId !== null ? `market:${marketId}` : id ? `id:${id}` : JSON.stringify([station.systemName, station.stationName])
    const existing = stations.get(identity)
    stations.set(identity, existing ? mergeStationModules(existing, raw) : raw)
  }
  return [...stations.values()]
    .sort((left, right) => distance(left) - distance(right))
    .slice(0, SPANSH_SEARCH_CANDIDATE_LIMIT)
}

function distance (raw: Record<string, unknown>): number {
  return spanshNonnegativeNumber(raw.distance) ?? Infinity
}

function mergeStationModules (first: Record<string, unknown>, second: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(first.modules) && !Array.isArray(second.modules)) return first
  const modules = new Map<string, Record<string, unknown>>()
  for (const module of [...spanshRecords(first.modules), ...spanshRecords(second.modules)]) {
    const symbol = spanshString(module.ed_symbol)
    const identity = symbol ?? JSON.stringify([module.name, module.class, module.rating, module.ship, module.weapon_mode])
    if (!modules.has(identity)) modules.set(identity, module)
  }
  return { ...first, modules: [...modules.values()] }
}
