import type { MaterialTraderSearchSource, NearbyStation } from '../domain/station-market.js'
import type { SpanshSearchGateway } from './spansh-search-client.js'
import { spanshNearbyStation, spanshStationRecord } from './spansh-station-record.js'
import { searchSpanshStations } from './spansh-station-search.js'

export class SpanshMaterialTraderSource implements MaterialTraderSearchSource {
  public constructor (private readonly spansh: SpanshSearchGateway) {}

  public async findMaterialTraders (request: Parameters<MaterialTraderSearchSource['findMaterialTraders']>[0]): Promise<NearbyStation[]> {
    const filters: Record<string, unknown> = { material_trader: { value: [request.traderType] } }
    const candidates = await searchSpanshStations(this.spansh, { filters, referencePosition: request.referencePosition }, request.minimumPadSize)
    return candidates.flatMap(candidate => {
      const station = spanshStationRecord(candidate)
      if (!station || station.raw.material_trader !== request.traderType) return []
      const nearby = spanshNearbyStation(station, request.minimumPadSize)
      return nearby ? [nearby] : []
    }).sort((a, b) => a.distanceLy - b.distanceLy)
  }
}
