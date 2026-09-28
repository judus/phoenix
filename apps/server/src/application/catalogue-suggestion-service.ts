import type { CatalogueSuggestion, CatalogueSuggestionKind } from '@phoenix/contracts'
import { matchCatalogueSuggestions, type GameCatalogue } from '@phoenix/elite'
import type { OutfittingSearchSource, ShipyardSearchSource } from '../domain/station-market.js'

export class CatalogueSuggestionService {
  public constructor(
    private readonly catalogue: Pick<GameCatalogue, 'listCommodities' | 'listShips'>,
    private readonly ships: Pick<ShipyardSearchSource, 'shipNames'>,
    private readonly modules: Pick<OutfittingSearchSource, 'moduleNames'>
  ) {}

  public async suggest(kind: CatalogueSuggestionKind, query: string): Promise<CatalogueSuggestion[]> {
    if (query.replace(/[^a-z0-9]/gi, '').length < 2) return []
    if (kind === 'commodity') return matchCatalogueSuggestions(this.catalogue.listCommodities().map(item => ({
      label: item.displayName, value: item.symbol, source: 'Elite'
    })), kind, query)
    const names = await (kind === 'ship' ? this.ships.shipNames() : this.modules.moduleNames())
    const ships = kind === 'ship' ? this.catalogue.listShips() : []
    return matchCatalogueSuggestions(names.map(name => ({
      label: name, value: name, source: 'Spansh',
      // Only attach a local identifier when the established display names agree.
      aliases: ships.filter(ship => nameKey(ship.displayName) === nameKey(name)).map(ship => ship.id)
    })), kind, query)
  }
}

function nameKey(name: string): string { return name.toLowerCase().replace(/[^a-z0-9]/g, '') }
