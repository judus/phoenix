import type {
  ShipyardSearchRequest,
  ShipyardSearchResult,
  ShipyardSearchSource
} from '../domain/station-market.js'
import type { SpanshSearchGateway } from './spansh-search-client.js'
import {
  sameSpanshName,
  spanshIsoString,
  spanshNonnegativeNumber,
  spanshRecords,
  spanshStationRecord,
  spanshString
} from './spansh-station-record.js'

export class SpanshShipyardSearchSource implements ShipyardSearchSource {
  private names: { expires: number, value: Promise<string[]> } | undefined

  public shipNames (): Promise<string[]> {
    if (!this.names || this.names.expires < Date.now()) {
      const value = this.spansh.findFieldValues('stations', 'ships', '').catch(error => {
        this.names = undefined
        throw error
      })
      this.names = { expires: Date.now() + 86_400_000, value }
    }
    return this.names.value
  }
  public constructor (private readonly spansh: SpanshSearchGateway) {}

  public async findShipyards (request: ShipyardSearchRequest): Promise<ShipyardSearchResult[]> {
    const candidates = await this.spansh.search('stations', {
      filters: { ships: { value: [request.hullName] } },
      referencePosition: request.referencePosition
    })
    return candidates
      .map(candidate => mapShipyard(candidate, request.hullName))
      .filter(isPresent)
  }
}

function mapShipyard (candidate: unknown, requestedHull: string): ShipyardSearchResult | null {
  const station = spanshStationRecord(candidate)
  if (!station) return null
  const { raw, ...location } = station

  const ship = spanshRecords(raw.ships)
    .find(candidate => sameSpanshName(spanshString(candidate.name), requestedHull))
  if (!ship) return null

  return {
    ...location,
    price: spanshNonnegativeNumber(ship.price),
    shipSymbol: spanshString(ship.symbol),
    updatedAt: spanshIsoString(raw.shipyard_updated_at)
  }
}

function isPresent<T> (value: T | null): value is T {
  return value !== null
}
