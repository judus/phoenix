import type { GameCatalogue } from '@phoenix/elite'
import type { SystemCartography } from '../domain/cartography.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'
import type { ExplorationTargetSearchSource } from '../domain/exploration-target.js'
import type {
  FactionPresenceSearchSource, MaterialTraderSearchSource, OutfittingSearchSource,
  ProviderResponseCache, ShipyardSearchSource, StationLookupSource, StationSearchSource,
  StationServiceSearchSource, StationStockSource, SystemSearchSource
} from '../domain/station-market.js'
import { CatalogueSuggestionService } from '../application/catalogue-suggestion-service.js'
import { DefaultExplorationTargetQuery } from '../application/default-exploration-target-query.js'
import { DefaultStationMarketQuery } from '../application/default-station-market-query.js'
import { MarketSignalService } from '../application/market-signal-service.js'
import { ArdentStationSearchSource } from './ardent-station-search-source.js'
import { EdsmStationStockSource } from './edsm-station-stock-source.js'
import { SpanshExplorationTargetSource } from './spansh-exploration-target-source.js'
import { SpanshFactionPresenceSource } from './spansh-faction-presence-source.js'
import { SpanshMaterialTraderSource } from './spansh-material-trader-source.js'
import { SpanshOutfittingSearchSource } from './spansh-outfitting-search-source.js'
import { SpanshSearchClient } from './spansh-search-client.js'
import { SpanshShipyardSearchSource } from './spansh-shipyard-search-source.js'
import { SpanshStationLookupSource } from './spansh-station-lookup-source.js'
import { SpanshStationServiceSource } from './spansh-station-service-source.js'
import { SpanshSystemSearchSource } from './spansh-system-search-source.js'

export interface GalaxyQuerySources {
  stationSearchSource?: StationSearchSource
  shipyardSearchSource?: ShipyardSearchSource
  outfittingSearchSource?: OutfittingSearchSource
  stationLookupSource?: StationLookupSource
  materialTraderSource?: MaterialTraderSearchSource
  stationServiceSource?: StationServiceSearchSource
  systemSearchSource?: SystemSearchSource
  factionPresenceSource?: FactionPresenceSearchSource
  explorationTargetSource?: ExplorationTargetSearchSource
  stationStockSource?: StationStockSource
}

// Assemble shared provider instances once; query services retain their own cache policies.
// The caller owns cartography, runtime state and persistence, including their lifecycle.
export function createGalaxyQueries(
  catalogue: GameCatalogue,
  cartography: SystemCartography,
  runtimeState: RuntimeStateReader,
  cache: ProviderResponseCache,
  sources: GalaxyQuerySources
) {
  const spansh = new SpanshSearchClient()
  const stations = sources.stationSearchSource ?? new ArdentStationSearchSource({
    resolveCommodity: identifier => catalogue.resolveCommodity(identifier)
  })
  const shipyards = sources.shipyardSearchSource ?? new SpanshShipyardSearchSource(spansh)
  const outfitting = sources.outfittingSearchSource ?? new SpanshOutfittingSearchSource(spansh)
  return {
    catalogueSuggestions: new CatalogueSuggestionService(catalogue, shipyards, outfitting),
    stationMarkets: new DefaultStationMarketQuery(
      stations,
      sources.stationStockSource ?? new EdsmStationStockSource(),
      shipyards,
      outfitting,
      sources.stationLookupSource ?? new SpanshStationLookupSource(spansh),
      sources.systemSearchSource ?? new SpanshSystemSearchSource(spansh),
      sources.factionPresenceSource ?? new SpanshFactionPresenceSource(spansh),
      cartography,
      runtimeState,
      cache,
      undefined,
      sources.materialTraderSource ?? new SpanshMaterialTraderSource(spansh),
      sources.stationServiceSource ?? new SpanshStationServiceSource(spansh)
    ),
    marketSignals: new MarketSignalService(stations, cache),
    explorationTargets: new DefaultExplorationTargetQuery(
      sources.explorationTargetSource ?? new SpanshExplorationTargetSource(spansh),
      cartography,
      runtimeState,
      cache
    )
  }
}
