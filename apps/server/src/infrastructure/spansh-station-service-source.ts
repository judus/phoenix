import type { NearbyStation, StationServiceSearchSource } from '../domain/station-market.js'
import type { SpanshSearchGateway } from './spansh-search-client.js'
import { spanshIsoString, spanshNames, spanshStationRecord, spanshString } from './spansh-station-record.js'

export class SpanshStationServiceSource implements StationServiceSearchSource {
  public constructor (private readonly spansh: SpanshSearchGateway) {}

  public async findStationsWithService (request: Parameters<StationServiceSearchSource['findStationsWithService']>[0]): Promise<NearbyStation[]> {
    const filters: Record<string, unknown> = { services: { value: [request.service] } }
    if (request.minimumPadSize === 3) filters.has_large_pad = { value: true }
    const candidates = await this.spansh.search('stations', { filters, referencePosition: request.referencePosition })
    return candidates.flatMap(candidate => {
      const station = spanshStationRecord(candidate)
      if (!station || !spanshNames(station.raw.services).includes(request.service)) return []
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
