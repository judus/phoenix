import {
  Button,
  DataTableGroup,
  SortableDataTable,
  type SortableDataTableColumn
} from '@phoenix/ui'
import type { ReactNode } from 'react'
import type {
  GalaxyCommodityMarket,
  GalaxyCommodityMarketsResponse,
  GalaxyExplorationTarget,
  GalaxyExplorationTargetsResponse,
  GalaxyFactionPresence,
  GalaxyFactionPresencesResponse,
  GalaxyMarketSignal,
  GalaxyMarketSignalsResponse,
  GalaxyNearbyStation,
  GalaxyNearestStationsResponse,
  GalaxyOutfittingMatch,
  GalaxyOutfittingResponse,
  GalaxyShipyard,
  GalaxyShipyardsResponse,
  GalaxyStationLookupResult,
  GalaxyStationLookupResponse,
  GalaxySystemSearchResponse,
  GalaxySystemSearchResult,
  GalaxyTradeOpportunity,
  GalaxyTradeOpportunitiesResponse
} from '@phoenix/contracts'
import { formatPhoenixCredits } from '../../components/phoenix-credits.js'
import { formatPhoenixDateTime } from '../../components/phoenix-date-time.js'
import { SystemSchematicLink } from '../../components/system-location-link.js'

export type GalaxyQueryResult =
  | { id: 'commodity-markets', value: GalaxyCommodityMarketsResponse }
  | { id: 'exploration-targets', value: GalaxyExplorationTargetsResponse }
  | { id: 'facilities', value: GalaxyNearestStationsResponse }
  | { id: 'faction-presence', value: GalaxyFactionPresencesResponse }
  | { id: 'market-signals', value: GalaxyMarketSignalsResponse }
  | { id: 'outfitting-stock', value: GalaxyOutfittingResponse }
  | { id: 'shipyards', value: GalaxyShipyardsResponse }
  | { id: 'station-lookup', value: GalaxyStationLookupResponse }
  | { id: 'system-search', value: GalaxySystemSearchResponse }
  | { id: 'trade-opportunities', value: GalaxyTradeOpportunitiesResponse }

export function GalaxyQueryResults({ actions, children, onEdit, result }: { actions?: ReactNode, children?: ReactNode, onEdit(): void, result: GalaxyQueryResult }) {
  return (
    <DataTableGroup className="query-results" title="Query results" meta={`${galaxyQueryResultCount(result)} results`}>
      <GalaxyResultTable result={result} />
      {children}
      <div className="query-result-actions"><Button variant="outline" type="button" onClick={onEdit}>Change query</Button>{actions}</div>
    </DataTableGroup>
  )
}

export function galaxyQueryResultCount(result: GalaxyQueryResult): number {
  switch (result.id) {
    case 'system-search': return result.value.systems.length
    case 'shipyards': return result.value.shipyards.length
    case 'facilities': return result.value.stations.length
    case 'commodity-markets': return result.value.markets.length
    case 'outfitting-stock': return result.value.matches.length
    case 'station-lookup': return result.value.matches.length
    case 'faction-presence': return result.value.presences.length
    case 'market-signals': return result.value.signals.length
    case 'trade-opportunities': return result.value.opportunities.length
    case 'exploration-targets': return result.value.targets.length
  }
}

function GalaxyResultTable({ result }: { result: GalaxyQueryResult }) {
  switch (result.id) {
    case 'system-search': return <QueryResultTable columns={SYSTEM_COLUMNS} rowKey={row => row.systemName} rows={result.value.systems} />
    case 'shipyards': return <QueryResultTable columns={SHIPYARD_COLUMNS} rowKey={(row, index) => stationKey(row, index)} rows={result.value.shipyards} />
    case 'facilities': return <QueryResultTable columns={FACILITY_COLUMNS} rowKey={(row, index) => stationKey(row, index)} rows={result.value.stations} />
    case 'commodity-markets': return <QueryResultTable columns={commodityColumns(result.value.intent)} rowKey={(row, index) => stationKey(row, index)} rows={result.value.markets} />
    case 'outfitting-stock': return <QueryResultTable columns={OUTFITTING_COLUMNS} rowKey={(row, index) => stationKey(row, index)} rows={result.value.matches} />
    case 'station-lookup': return <QueryResultTable columns={STATION_COLUMNS} rowKey={(row, index) => stationKey(row, index)} rows={result.value.matches} />
    case 'faction-presence': return <QueryResultTable columns={FACTION_COLUMNS} rowKey={(row, index) => `${row.systemName}:${row.factionName}:${index}`} rows={result.value.presences} />
    case 'market-signals': return <QueryResultTable columns={MARKET_SIGNAL_COLUMNS} rowKey={(row, index) => `${row.side}:${row.commodityName}:${row.marketId ?? row.stationName}:${index}`} rows={result.value.signals} />
    case 'trade-opportunities': return <QueryResultTable columns={TRADE_COLUMNS} rowKey={(row, index) => `${row.commodityName}:${row.sellMarket.systemName}:${row.sellMarket.stationName}:${index}`} rows={result.value.opportunities} />
    case 'exploration-targets': return <QueryResultTable columns={EXPLORATION_COLUMNS} rowKey={(row, index) => `${row.systemName}:${row.bodyName}:${index}`} rows={result.value.targets} />
  }
}

function QueryResultTable<T>({ columns, rowKey, rows }: {
  columns: readonly SortableDataTableColumn<T>[]
  rowKey(row: T, originalIndex: number): string
  rows: readonly T[]
}) {
  return <SortableDataTable
    columns={columns}
    density="compact"
    empty="No matching community reports."
    label="Galaxy query results"
    minimum="wide"
    rowKey={rowKey}
    rows={rows}
    scheme="surface"
    stickyHeader
  />
}

const SYSTEM_COLUMNS: readonly SortableDataTableColumn<GalaxySystemSearchResult>[] = [
  systemColumn<GalaxySystemSearchResult>(true),
  distanceColumn<GalaxySystemSearchResult>(),
  textColumn('economy', 'Economy', row => row.economy),
  textColumn('government', 'Government', row => row.government),
  textColumn('security', 'Security', row => row.security),
  {
    cell: row => row.inhabited ? row.population.toLocaleString() : 'Uninhabited',
    className: 'numeric',
    heading: 'Population',
    id: 'population',
    sortValue: row => row.population
  },
  reportedColumn<GalaxySystemSearchResult>()
]

const SHIPYARD_COLUMNS: readonly SortableDataTableColumn<GalaxyShipyard>[] = [
  stationColumn<GalaxyShipyard>(),
  systemColumn<GalaxyShipyard>(),
  distanceColumn<GalaxyShipyard>(),
  arrivalColumn<GalaxyShipyard>(),
  textColumn('type', 'Type', row => row.stationType),
  padColumn<GalaxyShipyard>(),
  creditColumn('price', 'Price', row => row.price),
  reportedColumn<GalaxyShipyard>()
]

const FACILITY_COLUMNS: readonly SortableDataTableColumn<GalaxyNearbyStation>[] = [
  stationColumn<GalaxyNearbyStation>(),
  systemColumn<GalaxyNearbyStation>(),
  distanceColumn<GalaxyNearbyStation>(),
  arrivalColumn<GalaxyNearbyStation>(),
  textColumn('type', 'Type', row => row.stationType),
  padColumn<GalaxyNearbyStation>(),
  reportedColumn<GalaxyNearbyStation>()
]

const OUTFITTING_COLUMNS: readonly SortableDataTableColumn<GalaxyOutfittingMatch>[] = [
  stationColumn<GalaxyOutfittingMatch>(),
  systemColumn<GalaxyOutfittingMatch>(),
  distanceColumn<GalaxyOutfittingMatch>(),
  textColumn('module', 'Module', row => row.moduleName),
  numberColumn('class', 'Class', row => row.moduleClass),
  textColumn('rating', 'Rating', row => row.moduleRating),
  creditColumn('price', 'Price', row => row.price),
  reportedColumn<GalaxyOutfittingMatch>()
]

const STATION_COLUMNS: readonly SortableDataTableColumn<GalaxyStationLookupResult>[] = [
  stationColumn<GalaxyStationLookupResult>(),
  systemColumn<GalaxyStationLookupResult>(),
  distanceColumn<GalaxyStationLookupResult>(),
  arrivalColumn<GalaxyStationLookupResult>(),
  textColumn('type', 'Type', row => row.stationType),
  padColumn<GalaxyStationLookupResult>(),
  {
    cell: row => row.services.join(', ') || '—',
    heading: 'Services',
    id: 'services',
    sortValue: row => row.services.join(', ')
  },
  reportedColumn<GalaxyStationLookupResult>()
]

const FACTION_COLUMNS: readonly SortableDataTableColumn<GalaxyFactionPresence>[] = [
  textColumn('faction', 'Faction', row => row.factionName, true),
  systemColumn<GalaxyFactionPresence>(),
  distanceColumn<GalaxyFactionPresence>(),
  {
    cell: row => `${formatDecimal(row.influencePercent)}%`,
    className: 'numeric',
    heading: 'Influence',
    id: 'influence',
    sortValue: row => row.influencePercent
  },
  textColumn('state', 'State', row => row.state),
  {
    cell: row => row.controlling ? 'Yes' : 'No',
    heading: 'Controlling',
    id: 'controlling',
    sortValue: row => row.controlling ? 1 : 0
  },
  reportedColumn<GalaxyFactionPresence>()
]

const TRADE_COLUMNS: readonly SortableDataTableColumn<GalaxyTradeOpportunity>[] = [
  textColumn('commodity', 'Commodity', row => row.commodityName, true),
  {
    cell: row => <SystemSchematicLink label={row.buyMarket.stationName} selectedName={row.buyMarket.stationName} systemName={row.buyMarket.systemName} />,
    heading: 'Buy at',
    id: 'buy-market',
    sortValue: row => row.buyMarket.stationName
  },
  {
    cell: row => <SystemSchematicLink label={row.sellMarket.systemName} systemName={row.sellMarket.systemName} />,
    heading: 'Destination',
    id: 'destination',
    sortValue: row => row.sellMarket.systemName
  },
  {
    cell: row => <SystemSchematicLink label={row.sellMarket.stationName} selectedName={row.sellMarket.stationName} systemName={row.sellMarket.systemName} />,
    heading: 'Sell at',
    id: 'sell-market',
    sortValue: row => row.sellMarket.stationName
  },
  {
    cell: row => formatDistance(row.travelDistanceLy),
    className: 'numeric',
    heading: 'Distance',
    id: 'distance',
    sortValue: row => row.travelDistanceLy
  },
  creditColumn('margin', 'Margin / t', row => row.unitMargin),
  {
    cell: row => `${row.units.toLocaleString()} t`,
    className: 'numeric',
    heading: 'Cargo',
    id: 'cargo',
    sortValue: row => row.units
  },
  creditColumn('profit', 'Profit', row => row.projectedProfit),
  {
    cell: row => formatReported(row.sellMarket.updatedAt),
    heading: 'Reported',
    id: 'reported',
    sortValue: row => timestampValue(row.sellMarket.updatedAt)
  }
]

const MARKET_SIGNAL_COLUMNS: readonly SortableDataTableColumn<GalaxyMarketSignal>[] = [
  textColumn('commodity', 'Commodity', row => row.commodityName, true),
  {
    cell: row => row.side === 'buy' ? 'Buy' : 'Sell',
    heading: 'Action',
    id: 'action',
    sortValue: row => row.side
  },
  stationColumn<GalaxyMarketSignal>(),
  creditColumn('price', 'Price', row => row.price),
  {
    cell: row => `${row.side === 'buy' ? '−' : '+'}${formatDecimal(row.deviationPercent)}%`,
    className: 'numeric',
    heading: 'Difference',
    id: 'difference',
    sortValue: row => row.deviationPercent
  },
  {
    cell: row => row.unlimitedVolume ? 'Unlimited' : `${row.volume.toLocaleString()} t`,
    className: 'numeric',
    heading: 'Volume',
    id: 'volume',
    sortValue: row => row.unlimitedVolume ? Number.MAX_SAFE_INTEGER : row.volume
  },
  arrivalColumn<GalaxyMarketSignal>(),
  padColumn<GalaxyMarketSignal>(),
  reportedColumn<GalaxyMarketSignal>()
]

const EXPLORATION_COLUMNS: readonly SortableDataTableColumn<GalaxyExplorationTarget>[] = [
  {
    cell: row => <SystemSchematicLink label={row.bodyName} selectedName={row.bodyName} systemName={row.systemName} />,
    heading: 'Body',
    id: 'body',
    rowHeader: true,
    sortValue: row => row.bodyName
  },
  systemColumn<GalaxyExplorationTarget>(),
  distanceColumn<GalaxyExplorationTarget>(),
  textColumn('type', 'Type', row => row.subtype ?? row.bodyType),
  numberColumn('biological', 'Biological', row => row.biologicalSignals),
  numberColumn('geological', 'Geological', row => row.geologicalSignals),
  {
    cell: row => formatReported(row.signalsUpdatedAt ?? row.providerUpdatedAt),
    heading: 'Reported',
    id: 'reported',
    sortValue: row => timestampValue(row.signalsUpdatedAt ?? row.providerUpdatedAt)
  }
]

function commodityColumns(intent: 'buy' | 'sell'): readonly SortableDataTableColumn<GalaxyCommodityMarket>[] {
  const price = intent === 'buy' ? (row: GalaxyCommodityMarket) => row.buyPrice : (row: GalaxyCommodityMarket) => row.sellPrice
  const volume = intent === 'buy' ? (row: GalaxyCommodityMarket) => row.stock : (row: GalaxyCommodityMarket) => row.demand
  return [
    stationColumn<GalaxyCommodityMarket>(),
    systemColumn<GalaxyCommodityMarket>(),
    distanceColumn<GalaxyCommodityMarket>(),
    textColumn('commodity', 'Commodity', row => row.commodityName),
    creditColumn('price', 'Price', price),
    numberColumn('volume', 'Volume', volume),
    padColumn<GalaxyCommodityMarket>(),
    reportedColumn<GalaxyCommodityMarket>()
  ]
}

function stationColumn<T extends { stationName: string, systemName: string }>(): SortableDataTableColumn<T> {
  return {
    cell: row => <SystemSchematicLink label={row.stationName} selectedName={row.stationName} systemName={row.systemName} />,
    heading: 'Station',
    id: 'station',
    rowHeader: true,
    sortValue: row => row.stationName
  }
}

function systemColumn<T extends { systemName: string }>(rowHeader = false): SortableDataTableColumn<T> {
  return {
    cell: row => <SystemSchematicLink label={row.systemName} systemName={row.systemName} />,
    heading: 'System',
    id: 'system',
    rowHeader,
    sortValue: row => row.systemName
  }
}

function distanceColumn<T extends { distanceLy: number | null }>(): SortableDataTableColumn<T> {
  return {
    cell: row => formatDistance(row.distanceLy),
    className: 'numeric',
    heading: 'Distance',
    id: 'distance',
    sortValue: row => row.distanceLy
  }
}

function arrivalColumn<T extends { distanceToArrivalLs: number | null }>(): SortableDataTableColumn<T> {
  return {
    cell: row => row.distanceToArrivalLs === null ? '—' : `${row.distanceToArrivalLs.toLocaleString()} ls`,
    className: 'numeric',
    heading: 'Arrival',
    id: 'arrival',
    sortValue: row => row.distanceToArrivalLs
  }
}

function padColumn<T extends { maxLandingPadSize: number | null }>(): SortableDataTableColumn<T> {
  return {
    cell: row => padLabel(row.maxLandingPadSize),
    heading: 'Pad',
    id: 'pad',
    sortValue: row => row.maxLandingPadSize
  }
}

function reportedColumn<T extends { updatedAt: string | null }>(): SortableDataTableColumn<T> {
  return {
    cell: row => formatReported(row.updatedAt),
    heading: 'Reported',
    id: 'reported',
    sortValue: row => timestampValue(row.updatedAt)
  }
}

function textColumn<T>(id: string, heading: string, value: (row: T) => string | null, rowHeader = false): SortableDataTableColumn<T> {
  return { cell: row => value(row) ?? '—', heading, id, rowHeader, sortValue: value }
}

function numberColumn<T>(id: string, heading: string, value: (row: T) => number | null): SortableDataTableColumn<T> {
  return { cell: row => value(row)?.toLocaleString() ?? '—', className: 'numeric', heading, id, sortValue: value }
}

function creditColumn<T>(id: string, heading: string, value: (row: T) => number | null): SortableDataTableColumn<T> {
  return { cell: row => credits(value(row)), className: 'numeric', heading, id, sortValue: value }
}

function stationKey(row: { stationName: string, systemName: string }, index: number): string {
  return `${row.systemName}:${row.stationName}:${index}`
}

function credits(value: number | null): string { return formatPhoenixCredits(value) }
function formatDecimal(value: number): string { return value.toLocaleString(undefined, { maximumFractionDigits: 2 }) }
function formatDistance(value: number | null): string { return value === null ? '—' : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ly` }
function formatReported(value: string | null): string { return value === null ? 'Unknown' : formatTimestamp(value) }
function formatTimestamp(timestamp: string): string { return formatPhoenixDateTime(timestamp) }
function padLabel(value: number | null): string { return value === 3 ? 'Large' : value === 2 ? 'Medium' : value === 1 ? 'Small' : 'Unknown' }
function timestampValue(value: string | null): number | null { return value === null ? null : Date.parse(value) }
