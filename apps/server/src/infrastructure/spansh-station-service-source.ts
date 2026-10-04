import type { NearbyStation, StationServiceSearchSource } from '../domain/station-market.js'
import type { SpanshSearchGateway } from './spansh-search-client.js'
import { spanshNames, spanshNearbyStation, spanshStationRecord } from './spansh-station-record.js'
import { searchSpanshStations } from './spansh-station-search.js'

export class SpanshStationServiceSource implements StationServiceSearchSource {
  public constructor (private readonly spansh: SpanshSearchGateway) {}

  public async findStationsWithService (request: Parameters<StationServiceSearchSource['findStationsWithService']>[0]): Promise<NearbyStation[]> {
    const filters: Record<string, unknown> = { services: { value: [request.service] } }
    const candidates = await searchSpanshStations(this.spansh, { filters, referencePosition: request.referencePosition }, request.minimumPadSize)
    return candidates.flatMap(candidate => {
      const station = spanshStationRecord(candidate)
      if (!station || !spanshNames(station.raw.services).includes(request.service)) return []
      const nearby = spanshNearbyStation(station, request.minimumPadSize)
      return nearby ? [nearby] : []
    }).sort((a, b) => a.distanceLy - b.distanceLy)
  }
}
