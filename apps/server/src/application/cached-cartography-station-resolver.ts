import type { CartographyRepository } from '../domain/cartography.js'
import type { MarketStationResolver } from '../domain/fleet.js'

export class CachedCartographyStationResolver implements MarketStationResolver {
  public constructor (private readonly cartography: CartographyRepository) {}

  public resolve (systemName: string, marketId: number): string | null {
    const system = this.cartography.findRecord(systemName)?.external
    return system?.stations.find(station => station.marketId === marketId)?.name ?? null
  }
}
