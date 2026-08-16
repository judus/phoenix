import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type {
  GalaxyCommodityMarketsResponse,
  GalaxyFilteredSystemsResponse,
  GalaxyFactionPresencesResponse,
  GalaxyNearbySystemsResponse,
  GalaxyNearestStationsResponse,
  GalaxyOutfittingResponse,
  GalaxyStationLookupResponse,
  GalaxyShipyardsResponse
} from '@phoenix/contracts'
import type { PhoenixApi } from '../../api/phoenix-api-client.js'
import {
  GALAXY_QUERY_CATALOGUE,
  galaxyQueryDefinition,
  type GalaxyQueryDefinition,
  type GalaxyQueryField,
  type GalaxyQueryId
} from './galaxy-query-catalogue.js'

type GalaxyQueryResult =
  | { id: 'commodity-markets', value: GalaxyCommodityMarketsResponse }
  | { id: 'facilities', value: GalaxyNearestStationsResponse }
  | { id: 'filtered-systems', value: GalaxyFilteredSystemsResponse }
  | { id: 'faction-presence', value: GalaxyFactionPresencesResponse }
  | { id: 'nearby-systems', value: GalaxyNearbySystemsResponse }
  | { id: 'outfitting-stock', value: GalaxyOutfittingResponse }
  | { id: 'shipyards', value: GalaxyShipyardsResponse }
  | { id: 'station-lookup', value: GalaxyStationLookupResponse }

type ConsoleMode = 'configure' | 'results' | 'select'

export function GalaxyDatabase ({ api, currentSystem }: { api: PhoenixApi, currentSystem?: string | null }) {
  const initialRequest = useRef(readInitialRequest())
  const [selectedQueryId, setSelectedQueryId] = useState<GalaxyQueryId | undefined>(initialRequest.current.queryId)
  const [mode, setMode] = useState<ConsoleMode>(initialRequest.current.queryId ? 'configure' : 'select')
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(initialRequest.current, currentSystem))
  const [result, setResult] = useState<GalaxyQueryResult>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const definition = selectedQueryId ? galaxyQueryDefinition(selectedQueryId) : undefined
  const valid = definition ? fieldsValid(definition, values) : false

  useEffect(() => {
    if (!currentSystem) return
    setValues(current => current.origin ? current : { ...current, origin: currentSystem })
  }, [currentSystem])

  const execute = useCallback((): void => {
    if (!selectedQueryId || !definition || definition.status !== 'available' || !fieldsValid(definition, values)) return
    setPending(true)
    setError(undefined)
    void executeGalaxyQuery(api, selectedQueryId, values)
      .then(nextResult => {
        setResult(nextResult)
        setMode('results')
      })
      .catch(cause => setError(errorMessage(cause)))
      .finally(() => setPending(false))
  }, [api, definition, selectedQueryId, values])

  useEffect(() => {
    if (!initialRequest.current.execute || !valid) return
    initialRequest.current.execute = false
    execute()
  }, [execute, valid])

  const chooseQuery = (id: GalaxyQueryId): void => {
    const nextDefinition = galaxyQueryDefinition(id)
    setSelectedQueryId(id)
    setValues({ ...nextDefinition.defaults, origin: values.origin || currentSystem || '' })
    setResult(undefined)
    setError(undefined)
    setMode('configure')
  }

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    execute()
  }

  return (
    <div className={`galaxy-query-console galaxy-query-console--${mode}`}>
      <header className="galaxy-query-console__header">
        <div><span>Galaxy intelligence</span><h1>Query Console</h1></div>
        {mode === 'configure' && <button disabled={pending} type="button" onClick={() => setMode('select')}>Change query</button>}
      </header>
      {error && <p className="galaxy-database__error">{error}</p>}
      {mode === 'select' && <QuerySelector selected={selectedQueryId} onSelect={chooseQuery} />}
      {mode === 'configure' && definition && (
        <QueryConfigurator
          definition={definition}
          pending={pending}
          valid={valid}
          values={values}
          onChange={(id, value) => setValues(current => ({ ...current, [id]: value }))}
          onSubmit={submit}
        />
      )}
      {mode === 'results' && result && (
        <QueryResults
          result={result}
          summary={querySummary(result.id, values)}
          onModify={() => setMode('configure')}
        />
      )}
    </div>
  )
}

function QuerySelector ({ selected, onSelect }: { selected?: GalaxyQueryId, onSelect: (id: GalaxyQueryId) => void }) {
  return (
    <section className="galaxy-query-selector">
      {GALAXY_QUERY_CATALOGUE.map(definition => (
        <button
          className={definition.id === selected ? 'is-selected' : undefined}
          key={definition.id}
          type="button"
          onClick={() => onSelect(definition.id)}
        >
          <span>{definition.domain} · P{definition.priority}</span>
          <strong>{definition.title}</strong>
          <p>{definition.purpose}</p>
          <small>{definition.status}</small>
        </button>
      ))}
    </section>
  )
}

function QueryConfigurator ({ definition, pending, valid, values, onChange, onSubmit }: {
  definition: GalaxyQueryDefinition
  pending: boolean
  valid: boolean
  values: Record<string, string>
  onChange: (id: string, value: string) => void
  onSubmit: (event: FormEvent) => void
}) {
  return (
    <section className="galaxy-query-configurator">
      <header><span>{definition.domain} · P{definition.priority}</span><h2>{definition.title}</h2><p>{definition.purpose}</p></header>
      <form onSubmit={onSubmit}>
        <div className="galaxy-query-configurator__fields">
          {definition.fields.map(field => <QueryField field={field} key={field.id} value={values[field.id] ?? ''} onChange={value => onChange(field.id, value)} />)}
        </div>
        <footer>
          <p>{definition.status === 'planned' ? 'Query contract defined. Backend adapter not connected.' : 'Community reports may be incomplete or stale. Result timestamps remain visible.'}</p>
          <button disabled={definition.status !== 'available' || pending || !valid} type="submit">{pending ? 'Executing…' : 'Execute query'}</button>
        </footer>
      </form>
    </section>
  )
}

function QueryField ({ field, value, onChange }: { field: GalaxyQueryField, value: string, onChange: (value: string) => void }) {
  return (
    <label>
      <span>{field.label}</span>
      {field.type === 'select'
        ? <select required={field.required} value={value} onChange={event => onChange(event.target.value)}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        : <input max={field.max} min={field.min} placeholder={field.placeholder} required={field.required} type={field.type} value={value} onChange={event => onChange(event.target.value)} />}
    </label>
  )
}

function QueryResults ({ result, summary, onModify }: { result: GalaxyQueryResult, summary: string, onModify: () => void }) {
  return (
    <section className="galaxy-query-result-view">
      <header><span>{summary}</span><button type="button" onClick={onModify}>Modify query</button></header>
      {result.id === 'nearby-systems' && <NearbySystemResults result={result.value} />}
      {result.id === 'filtered-systems' && <FilteredSystemResults result={result.value} />}
      {result.id === 'faction-presence' && <FactionPresenceResults result={result.value} />}
      {result.id === 'shipyards' && <ShipyardResults result={result.value} />}
      {result.id === 'facilities' && <NearestResults result={result.value} />}
      {result.id === 'outfitting-stock' && <OutfittingResults result={result.value} />}
      {result.id === 'commodity-markets' && <MarketResults result={result.value} />}
      {result.id === 'station-lookup' && <StationLookupResults result={result.value} />}
    </section>
  )
}

function FilteredSystemResults ({ result }: { result: GalaxyFilteredSystemsResponse }) {
  return (
    <section className="galaxy-results">
      <header><div><span>Filtered systems</span><h2>{result.originSystem}</h2></div><small>{result.cache} cache · {result.systems.length} matches</small></header>
      <table><thead><tr><th>System</th><th>Distance</th><th>Population</th><th>Economy</th><th>Allegiance</th><th>Government</th><th>Security</th><th>Primary star</th><th>Permit</th><th>Reported</th></tr></thead>
        <tbody>{result.systems.map(system => <tr key={`${system.systemAddress ?? ''}:${system.systemName}`}><td><a href={systemHref(system.systemName)}>{system.systemName}</a>{system.controllingFaction && <small>{system.controllingFaction}</small>}</td><td>{distance(system.distanceLy, 'ly')}</td><td>{number(system.population)}</td><td>{[system.economy, system.secondaryEconomy].filter(Boolean).join(' / ') || '—'}</td><td>{system.allegiance ?? '—'}</td><td>{system.government ?? '—'}</td><td>{system.security ?? '—'}</td><td>{system.primaryStarClass ?? 'Unknown'}</td><td>{system.permitRequired === null ? 'Unknown' : system.permitRequired ? 'Required' : 'Open'}</td><td>{reportedAge(system.updatedAt)}</td></tr>)}</tbody>
      </table>
      {result.systems.length === 0 && <p>No reported systems matched this filter set.</p>}
    </section>
  )
}

function FactionPresenceResults ({ result }: { result: GalaxyFactionPresencesResponse }) {
  return (
    <section className="galaxy-results">
      <header><div><span>Faction presence</span><h2>{result.filters.factionName}</h2></div><small>{result.cache} cache · {result.presences.length} matches · community reports</small></header>
      <table><thead><tr><th>System</th><th>Distance</th><th>Influence</th><th>Control</th><th>State</th><th>Allegiance</th><th>Government</th><th>State changes</th><th>System reported</th></tr></thead>
        <tbody>{result.presences.map(presence => <tr key={`${presence.systemAddress ?? ''}:${presence.systemName}:${presence.factionName}`}><td><a href={systemHref(presence.systemName)}>{presence.systemName}</a></td><td>{distance(presence.distanceLy, 'ly')}</td><td>{percentage(presence.influencePercent)}</td><td>{presence.controlling ? 'Controlling' : 'Present'}</td><td>{presence.state ?? 'Unknown'}</td><td>{presence.allegiance ?? '—'}</td><td>{presence.government ?? '—'}</td><td>{factionStates(presence)}</td><td>{reportedAge(presence.updatedAt)}</td></tr>)}</tbody>
      </table>
      {result.presences.length === 0 && <p>No community-reported faction presence matched this filter set.</p>}
    </section>
  )
}

function ShipyardResults ({ result }: { result: GalaxyShipyardsResponse }) {
  return (
    <section className="galaxy-results">
      <header><div><span>Shipyards selling</span><h2>{result.hullName}</h2></div><small>{result.cache} cache · {result.shipyards.length} matches</small></header>
      <table><thead><tr><th>Shipyard</th><th>System</th><th>Price</th><th>Distance</th><th>Arrival</th><th>Pad</th><th>Reported</th></tr></thead>
        <tbody>{result.shipyards.map(shipyard => <tr key={`${shipyard.systemName}:${shipyard.stationName}:${shipyard.marketId ?? ''}`}><td>{shipyard.stationName}<small>{shipyard.stationType ?? 'Shipyard'}</small></td><td><a href={systemHref(shipyard.systemName)}>{shipyard.systemName}</a></td><td>{credits(shipyard.price)}</td><td>{distance(shipyard.distanceLy, 'ly')}</td><td>{distance(shipyard.distanceToArrivalLs, 'ls')}</td><td>{padLabel(shipyard.maxLandingPadSize)}</td><td>{reportedAge(shipyard.updatedAt)}</td></tr>)}</tbody>
      </table>
      {result.shipyards.length === 0 && <p>No reported shipyards currently sell this hull.</p>}
    </section>
  )
}

function NearbySystemResults ({ result }: { result: GalaxyNearbySystemsResponse }) {
  return (
    <section className="galaxy-results">
      <header><div><span>Nearby systems</span><h2>{result.originSystem}</h2></div><small>{result.cache} cache · {result.systems.length} within {result.maxDistanceLy} ly</small></header>
      <table><thead><tr><th>System</th><th>Distance</th><th>Coordinates</th><th>Reported</th></tr></thead>
        <tbody>{result.systems.map(system => <tr key={`${system.systemAddress ?? ''}:${system.systemName}`}><td><a href={systemHref(system.systemName)}>{system.systemName}</a></td><td>{distance(system.distanceLy, 'ly')}</td><td>{coordinates(system.position)}</td><td>{reportedAge(system.updatedAt)}</td></tr>)}</tbody>
      </table>
      {result.systems.length === 0 && <p>No systems were reported within this radius.</p>}
    </section>
  )
}

function NearestResults ({ result }: { result: GalaxyNearestStationsResponse }) {
  return (
    <section className="galaxy-results">
      <header><div><span>Nearest {labelService(result.service)}</span><h2>{result.originSystem}</h2></div><small>{result.cache} cache · {result.stations.length} matches</small></header>
      <table><thead><tr><th>Station</th><th>System</th><th>Distance</th><th>Arrival</th><th>Pad</th><th>Reported</th></tr></thead>
        <tbody>{result.stations.map(station => <tr key={`${station.systemName}:${station.stationName}`}><td>{station.stationName}<small>{station.stationType ?? 'Station'}</small></td><td><a href={systemHref(station.systemName)}>{station.systemName}</a></td><td>{distance(station.distanceLy, 'ly')}</td><td>{distance(station.distanceToArrivalLs, 'ls')}</td><td>{padLabel(station.maxLandingPadSize)}</td><td>{reportedAge(station.updatedAt)}</td></tr>)}</tbody>
      </table>
      {result.stations.length === 0 && <p>No matching facilities were reported.</p>}
    </section>
  )
}

function MarketResults ({ result }: { result: GalaxyCommodityMarketsResponse }) {
  const price = (market: GalaxyCommodityMarketsResponse['markets'][number]): number | null => result.intent === 'buy' ? market.buyPrice : market.sellPrice
  const volume = (market: GalaxyCommodityMarketsResponse['markets'][number]): number | null => result.intent === 'buy' ? market.stock : market.demand
  return (
    <section className="galaxy-results">
      <header><div><span>{result.intent === 'buy' ? 'Buy' : 'Sell'} {result.commodity}</span><h2>Markets near {result.originSystem}</h2></div><small>{result.cache} cache · {result.markets.length} matches</small></header>
      <table><thead><tr><th>Market</th><th>System</th><th>Price</th><th>{result.intent === 'buy' ? 'Stock' : 'Demand'}</th><th>Distance</th><th>Reported</th></tr></thead>
        <tbody>{result.markets.map(market => <tr key={`${market.systemName}:${market.stationName}:${market.marketId ?? ''}`}><td>{market.stationName}<small>{market.stationType ?? 'Market'}</small></td><td><a href={systemHref(market.systemName)}>{market.systemName}</a></td><td>{credits(price(market))}</td><td>{number(volume(market))}</td><td>{distance(market.distanceLy, 'ly')}</td><td>{reportedAge(market.updatedAt)}</td></tr>)}</tbody>
      </table>
      {result.markets.length === 0 && <p>No matching commodity markets were reported.</p>}
    </section>
  )
}

function OutfittingResults ({ result }: { result: GalaxyOutfittingResponse }) {
  return (
    <section className="galaxy-results">
      <header><div><span>Outfitting stock</span><h2>{moduleLabel(result)}</h2></div><small>{result.cache} cache · {result.matches.length} matches</small></header>
      <table><thead><tr><th>Station</th><th>System</th><th>Module</th><th>Price</th><th>Distance</th><th>Arrival</th><th>Pad</th><th>Reported</th></tr></thead>
        <tbody>{result.matches.map(match => <tr key={`${match.systemName}:${match.stationName}:${match.moduleSymbol ?? moduleLabel(match)}`}><td>{match.stationName}<small>{match.stationType ?? 'Outfitting'}</small></td><td><a href={systemHref(match.systemName)}>{match.systemName}</a></td><td>{moduleLabel(match)}{match.ship && <small>{match.ship}</small>}</td><td>{credits(match.price)}</td><td>{distance(match.distanceLy, 'ly')}</td><td>{distance(match.distanceToArrivalLs, 'ls')}</td><td>{padLabel(match.maxLandingPadSize)}</td><td>{reportedAge(match.updatedAt)}</td></tr>)}</tbody>
      </table>
      {result.matches.length === 0 && <p>No sufficiently recent stock reports matched this module.</p>}
    </section>
  )
}

function StationLookupResults ({ result }: { result: GalaxyStationLookupResponse }) {
  return (
    <section className="galaxy-results">
      <header><div><span>Station lookup</span><h2>{result.name}</h2></div><small>{result.cache} cache · {result.matches.length} matches near {result.originSystem}</small></header>
      <table><thead><tr><th>Station</th><th>System</th><th>Distance</th><th>Arrival</th><th>Pad</th><th>Economy</th><th>Government</th><th>Services</th><th>Reported</th></tr></thead>
        <tbody>{result.matches.map(station => <tr key={`${station.systemName}:${station.stationName}:${station.marketId ?? ''}`}><td>{station.stationName}<small>{station.stationType ?? 'Station'}</small></td><td><a href={systemHref(station.systemName)}>{station.systemName}</a></td><td>{distance(station.distanceLy, 'ly')}</td><td>{distance(station.distanceToArrivalLs, 'ls')}</td><td>{padLabel(station.maxLandingPadSize)}</td><td>{[station.primaryEconomy, station.secondaryEconomy].filter(Boolean).join(' / ') || '—'}</td><td>{station.government ?? '—'}{station.controllingFaction && <small>{station.controllingFaction}</small>}</td><td>{station.services.length > 0 ? station.services.join(', ') : '—'}</td><td>{reportedAge(station.updatedAt)}</td></tr>)}</tbody>
      </table>
      {result.matches.length === 0 && <p>No reported stations matched this partial name and filter set.</p>}
    </section>
  )
}

function systemHref (systemName: string): string {
  return systemName.trim() ? `#/galaxy/system?name=${encodeURIComponent(systemName.trim())}` : '#/galaxy/system'
}

interface InitialQueryRequest {
  execute: boolean
  queryId?: GalaxyQueryId
  values: Record<string, string>
}

function readInitialRequest (): InitialQueryRequest {
  const query = hashQuery()
  const requestedId = query.get('query') ?? (query.get('search') === 'shipyards' ? 'shipyards' : null)
  const queryId = GALAXY_QUERY_CATALOGUE.some(definition => definition.id === requestedId)
    ? requestedId as GalaxyQueryId
    : undefined
  return {
    execute: query.get('execute') === '1' || query.get('search') === 'shipyards',
    queryId,
    values: Object.fromEntries(query.entries())
  }
}

function initialValues (request: InitialQueryRequest, currentSystem?: string | null): Record<string, string> {
  if (!request.queryId) return { origin: currentSystem ?? '' }
  return {
    ...galaxyQueryDefinition(request.queryId).defaults,
    ...request.values,
    origin: request.values.origin ?? currentSystem ?? ''
  }
}

function fieldsValid (definition: GalaxyQueryDefinition, values: Record<string, string>): boolean {
  return definition.fields.every(field => {
    const value = values[field.id]?.trim() ?? ''
    if (field.required && !value) return false
    if (field.type !== 'number' || !value) return true
    const numeric = Number(value)
    return Number.isFinite(numeric) && (field.min === undefined || numeric >= field.min) && (field.max === undefined || numeric <= field.max)
  })
}

async function executeGalaxyQuery (api: PhoenixApi, id: GalaxyQueryId, values: Record<string, string>): Promise<GalaxyQueryResult> {
  switch (id) {
    case 'nearby-systems':
      return { id, value: await api.findGalaxyNearbySystems({ maxDistance: numeric(values.radius), systemName: values.origin }) }
    case 'shipyards':
      return { id, value: await api.findGalaxyShipyards({ hullName: values.hull, systemName: values.origin }) }
    case 'facilities':
      return { id, value: await api.findGalaxyNearestStations({ minimumPadSize: values.pad as 'large' | 'medium' | 'small', service: values.service, systemName: values.origin }) }
    case 'commodity-markets':
      return {
        id,
        value: await api.findGalaxyCommodityMarkets({
          commodity: values.commodity,
          intent: values.intent as 'buy' | 'sell',
          maxDaysAgo: numeric(values.maxDaysAgo),
          maxDistance: numeric(values.maxDistance),
          minVolume: numeric(values.minVolume),
          systemName: values.origin
        })
      }
    case 'outfitting-stock':
      return {
        id,
        value: await api.findGalaxyOutfitting({
          maxDaysAgo: numeric(values.maxDaysAgo),
          maxDistance: numeric(values.maxDistance),
          minimumPadSize: values.pad as 'large' | 'medium' | 'small',
          module: values.module,
          systemName: values.origin
        })
      }
    case 'station-lookup':
      return {
        id,
        value: await api.findGalaxyStations({
          maxDistance: numeric(values.radius),
          minimumPadSize: values.pad as 'large' | 'medium' | 'small',
          name: values.name,
          stationType: values.stationType as 'any' | 'carrier' | 'orbital' | 'surface',
          systemName: values.origin
        })
      }
    case 'filtered-systems':
      return {
        id,
        value: await api.findGalaxyFilteredSystems({
          allegiance: optionalSelection(values.allegiance),
          economy: optionalSelection(values.economy),
          government: optionalSelection(values.government),
          maxDistance: numeric(values.radius),
          maxPopulation: optionalNumeric(values.maxPopulation),
          minPopulation: optionalNumeric(values.minPopulation),
          population: values.population as 'any' | 'inhabited' | 'uninhabited',
          security: optionalSelection(values.security),
          systemName: values.origin
        })
      }
    case 'faction-presence':
      return {
        id,
        value: await api.findGalaxyFactionPresences({
          allegiance: optionalSelection(values.allegiance),
          controlling: values.controlling as 'any' | 'yes' | 'no',
          factionName: values.faction,
          government: optionalSelection(values.government),
          maxDistance: numeric(values.maxDistance),
          minInfluence: numeric(values.minInfluence),
          state: optionalSelection(values.state),
          systemName: values.origin
        })
      }
    default:
      throw new Error(`${galaxyQueryDefinition(id).title} is not connected to a backend adapter.`)
  }
}

function querySummary (id: GalaxyQueryResult['id'], values: Record<string, string>): string {
  const origin = values.origin?.trim() || 'unknown system'
  if (id === 'shipyards') return `Shipyards · ${values.hull} · from ${origin}`
  if (id === 'facilities') return `${labelService(values.service)} · minimum ${values.pad} pad · from ${origin}`
  if (id === 'commodity-markets') return `${values.intent} ${values.commodity} · from ${origin}`
  if (id === 'outfitting-stock') return `${values.module} · minimum ${values.pad} pad · from ${origin}`
  if (id === 'station-lookup') return `Stations matching ${values.name} · ${values.stationType} · from ${origin}`
  if (id === 'filtered-systems') return `Filtered systems within ${values.radius} ly · from ${origin}`
  if (id === 'faction-presence') return `${values.faction} presence within ${values.maxDistance} ly · from ${origin}`
  return `Systems within ${values.radius} ly · from ${origin}`
}

function hashQuery (): URLSearchParams { return new URLSearchParams(window.location.hash.split('?')[1] ?? '') }
function numeric (value: string): number { return Number.parseInt(value, 10) }
function optionalNumeric (value: string): number | undefined { return value.trim() ? numeric(value) : undefined }
function optionalSelection (value: string): string | undefined { return value && value !== 'any' ? value : undefined }

function distance (value: number | null, unit: string): string { return value === null ? '—' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} ${unit}` }
function credits (value: number | null): string { return value === null ? '—' : `${new Intl.NumberFormat().format(value)} CR` }
function number (value: number | null): string { return value === null ? '—' : new Intl.NumberFormat().format(value) }
function percentage (value: number): string { return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)}%` }
function factionStates (presence: GalaxyFactionPresencesResponse['presences'][number]): string {
  return [
    presence.activeStates.length > 0 ? `Active: ${presence.activeStates.join(', ')}` : null,
    presence.pendingStates.length > 0 ? `Pending: ${presence.pendingStates.join(', ')}` : null,
    presence.recoveringStates.length > 0 ? `Recovering: ${presence.recoveringStates.join(', ')}` : null
  ].filter(Boolean).join(' · ') || '—'
}
function coordinates (value: [number, number, number]): string { return value.map(axis => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(axis)).join(' · ') }
function padLabel (value: number | null): string { return value === 3 ? 'Large' : value === 2 ? 'Medium' : value === 1 ? 'Small' : '—' }
function labelService (value: string): string { return value.replaceAll('-', ' ') }
function reportedAge (value: string | null): string { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Unknown' }
function moduleLabel (value: { moduleClass: number | null, moduleName: string, moduleRating: string | null }): string { return `${value.moduleClass ?? ''}${value.moduleRating ?? ''}${value.moduleClass !== null || value.moduleRating !== null ? ' ' : ''}${value.moduleName}` }
function errorMessage (cause: unknown): string { return cause instanceof Error ? cause.message : 'Galaxy search failed.' }
