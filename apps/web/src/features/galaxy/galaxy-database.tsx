import { useEffect, useState, type FormEvent } from 'react'
import type {
  GalaxyCommodityMarketsResponse,
  GalaxyNearbySystemsResponse,
  GalaxyNearestStationsResponse
} from '@phoenix/contracts'
import type { PhoenixApi } from '../../api/phoenix-api-client.js'

const SERVICES = [
  ['interstellar-factors', 'Interstellar factors'],
  ['material-trader', 'Material trader'],
  ['technology-broker', 'Technology broker'],
  ['black-market', 'Black market'],
  ['universal-cartographics', 'Universal Cartographics'],
  ['refuel', 'Refuel'],
  ['repair', 'Repair'],
  ['shipyard', 'Shipyard'],
  ['outfitting', 'Outfitting'],
  ['search-and-rescue', 'Search and rescue']
] as const

export function GalaxyDatabase ({ api, currentSystem }: { api: PhoenixApi, currentSystem?: string | null }) {
  const [origin, setOrigin] = useState(currentSystem ?? '')
  const [service, setService] = useState('material-trader')
  const [pad, setPad] = useState<'small' | 'medium' | 'large'>('medium')
  const [nearest, setNearest] = useState<GalaxyNearestStationsResponse>()
  const [radius, setRadius] = useState(50)
  const [nearbySystems, setNearbySystems] = useState<GalaxyNearbySystemsResponse>()
  const [commodity, setCommodity] = useState('gold')
  const [intent, setIntent] = useState<'buy' | 'sell'>('sell')
  const [markets, setMarkets] = useState<GalaxyCommodityMarketsResponse>()
  const [pending, setPending] = useState<'nearest' | 'markets' | 'systems'>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!origin && currentSystem) setOrigin(currentSystem)
  }, [currentSystem, origin])

  const findNearest = (event: FormEvent): void => {
    event.preventDefault()
    setPending('nearest')
    setError(undefined)
    void api.findGalaxyNearestStations({ minimumPadSize: pad, service, systemName: origin.trim() })
      .then(setNearest)
      .catch(cause => setError(errorMessage(cause)))
      .finally(() => setPending(undefined))
  }

  const findMarkets = (event: FormEvent): void => {
    event.preventDefault()
    setPending('markets')
    setError(undefined)
    void api.findGalaxyCommodityMarkets({
      commodity: commodity.trim(),
      intent,
      maxDaysAgo: 30,
      maxDistance: 100,
      minVolume: 1,
      systemName: origin.trim()
    }).then(setMarkets)
      .catch(cause => setError(errorMessage(cause)))
      .finally(() => setPending(undefined))
  }

  const findNearbySystems = (event: FormEvent): void => {
    event.preventDefault()
    setPending('systems')
    setError(undefined)
    void api.findGalaxyNearbySystems({ maxDistance: radius, systemName: origin.trim() })
      .then(setNearbySystems)
      .catch(cause => setError(errorMessage(cause)))
      .finally(() => setPending(undefined))
  }

  return (
    <div className="galaxy-database">
      <section className="galaxy-database__origin">
        <label htmlFor="galaxy-origin">Reference system</label>
        <input id="galaxy-origin" value={origin} onChange={event => setOrigin(event.target.value)} />
        <a href={systemHref(origin)}>Open system map</a>
      </section>

      {error && <p className="galaxy-database__error">{error}</p>}

      <div className="galaxy-database__tools">
        <section className="galaxy-tool">
          <header><span>Systems</span><h2>Find nearby systems</h2></header>
          <form onSubmit={findNearbySystems}>
            <label>Radius<input min="1" max="500" type="number" value={radius} onChange={event => setRadius(Number(event.target.value))} /></label>
            <span />
            <button disabled={!origin.trim() || radius < 1 || radius > 500 || pending !== undefined} type="submit">{pending === 'systems' ? 'Searching…' : 'Search'}</button>
          </form>
        </section>

        <section className="galaxy-tool">
          <header><span>Services</span><h2>Find nearest facility</h2></header>
          <form onSubmit={findNearest}>
            <label>Service<select value={service} onChange={event => setService(event.target.value)}>{SERVICES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label>Minimum pad<select value={pad} onChange={event => setPad(event.target.value as typeof pad)}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>
            <button disabled={!origin.trim() || pending !== undefined} type="submit">{pending === 'nearest' ? 'Searching…' : 'Search'}</button>
          </form>
        </section>

        <section className="galaxy-tool">
          <header><span>Markets</span><h2>Find commodity prices</h2></header>
          <form onSubmit={findMarkets}>
            <label>Commodity<input value={commodity} onChange={event => setCommodity(event.target.value)} /></label>
            <label>Commander intent<select value={intent} onChange={event => setIntent(event.target.value as typeof intent)}><option value="buy">Buy cargo</option><option value="sell">Sell cargo</option></select></label>
            <button disabled={!origin.trim() || !commodity.trim() || pending !== undefined} type="submit">{pending === 'markets' ? 'Searching…' : 'Search'}</button>
          </form>
        </section>
      </div>

      {nearbySystems && <NearbySystemResults result={nearbySystems} />}
      {nearest && <NearestResults result={nearest} />}
      {markets && <MarketResults result={markets} />}
      {!nearbySystems && !nearest && !markets && (
        <section className="galaxy-database__welcome">
          <strong>PHOENIX galaxy services online</strong>
          <p>Searches use community-reported EDDN data through Ardent. Results are cached locally and include their last reported age where available.</p>
        </section>
      )}
    </div>
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

function systemHref (systemName: string): string {
  return systemName.trim() ? `#/galaxy/system?name=${encodeURIComponent(systemName.trim())}` : '#/galaxy/system'
}

function distance (value: number | null, unit: string): string { return value === null ? '—' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value)} ${unit}` }
function credits (value: number | null): string { return value === null ? '—' : `${new Intl.NumberFormat().format(value)} CR` }
function number (value: number | null): string { return value === null ? '—' : new Intl.NumberFormat().format(value) }
function coordinates (value: [number, number, number]): string { return value.map(axis => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(axis)).join(' · ') }
function padLabel (value: number | null): string { return value === 3 ? 'Large' : value === 2 ? 'Medium' : value === 1 ? 'Small' : '—' }
function labelService (value: string): string { return value.replaceAll('-', ' ') }
function reportedAge (value: string | null): string { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Unknown' }
function errorMessage (cause: unknown): string { return cause instanceof Error ? cause.message : 'Galaxy search failed.' }
