import type { MaterialTraderSearchSource, NearbyStation } from '../domain/station-market.js'
import type { SpanshSearchGateway } from './spansh-search-client.js'
import { spanshIsoString, spanshStationRecord, spanshString } from './spansh-station-record.js'

export class SpanshMaterialTraderSource implements MaterialTraderSearchSource {
  public constructor (private readonly spansh: SpanshSearchGateway) {}

  public async findMaterialTraders (request: Parameters<MaterialTraderSearchSource['findMaterialTraders']>[0]): Promise<NearbyStation[]> {
    const filters: Record<string, unknown> = { material_trader: { value: [request.traderType] } }
    if (request.minimumPadSize === 3) filters.has_large_pad = { value: true }
    const candidates = await this.spansh.search('stations', { filters, referencePosition: request.referencePosition })
    return candidates.flatMap(candidate => {
      const station = spanshStationRecord(candidate)
      if (!station || station.raw.material_trader !== request.traderType) return []
      if (request.minimumPadSize !== null && (station.maxLandingPadSize === null || station.maxLandingPadSize < request.minimumPadSize)) return []
      const { raw, ...location } = station
      return [{
        ...location,
        allegiance: spanshString(raw.allegiance),
        controllingFaction: spanshString(raw.controlling_minor_faction),
        government: spanshString(raw.government),
        primaryEconomy: spanshString(raw.primary_economy),
        secondaryEconomy: spanshString(raw.secondary_economy),
        updatedAt: spanshIsoString(raw.updated_at)
      }]
    }).sort((a, b) => a.distanceLy - b.distanceLy)
  }
}
