import type {
  OutfittingSearchRequest,
  OutfittingSearchResult,
  OutfittingSearchSource
} from '../domain/station-market.js'
import type { SpanshSearchGateway } from './spansh-search-client.js'
import {
  sameSpanshName,
  spanshInteger,
  spanshIsoString,
  spanshNonnegativeNumber,
  spanshRecords,
  spanshStationRecord,
  spanshString
} from './spansh-station-record.js'

export class SpanshOutfittingSearchSource implements OutfittingSearchSource {
  public constructor (private readonly spansh: SpanshSearchGateway) {}

  public async findOutfitting (request: OutfittingSearchRequest): Promise<OutfittingSearchResult[]> {
    const moduleFilter: Record<string, unknown> = { name: [request.moduleName] }
    if (request.moduleClass !== null) moduleFilter.class = [String(request.moduleClass)]
    if (request.moduleRating !== null) moduleFilter.rating = [request.moduleRating]
    const filters: Record<string, unknown> = {
      distance: { max: String(request.maxDistanceLy), min: 0 },
      modules: moduleFilter
    }
    if (request.minimumPadSize === 3) filters.has_large_pad = { value: true }

    const candidates = await this.spansh.search('stations', {
      filters,
      referencePosition: request.referencePosition
    })
    return candidates.flatMap(candidate => mapStation(candidate, request))
  }
}

function mapStation (candidate: unknown, request: OutfittingSearchRequest): OutfittingSearchResult[] {
  const station = spanshStationRecord(candidate)
  if (!station) return []
  const { raw, ...location } = station
  if (station.distanceLy > request.maxDistanceLy) return []
  if (request.minimumPadSize !== null && (station.maxLandingPadSize === null || station.maxLandingPadSize < request.minimumPadSize)) return []

  return spanshRecords(raw.modules)
    .filter(module => matchesModule(module, request))
    .map(module => ({
      ...location,
      category: spanshString(module.category),
      moduleClass: spanshInteger(module.class),
      moduleName: spanshString(module.name)!,
      moduleRating: spanshString(module.rating),
      moduleSymbol: spanshString(module.ed_symbol),
      price: spanshNonnegativeNumber(module.price),
      ship: spanshString(module.ship),
      updatedAt: spanshIsoString(raw.outfitting_updated_at)
    }))
}

function matchesModule (module: Record<string, unknown>, request: OutfittingSearchRequest): boolean {
  const name = spanshString(module.name)
  const moduleClass = spanshInteger(module.class)
  const rating = spanshString(module.rating)
  return sameSpanshName(name, request.moduleName) &&
    (request.moduleClass === null || moduleClass === request.moduleClass) &&
    (request.moduleRating === null || sameSpanshName(rating, request.moduleRating))
}
