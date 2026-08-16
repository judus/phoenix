import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ActionTile,
  Breadcrumbs,
  Button,
  ControlContext,
  DataTable,
  DataTableGroup,
  Field,
  Form,
  FormActionGroup,
  FormActions,
  FormGrid,
  FormSection,
  NumberInput,
  PageFrame,
  PageHeader,
  Select,
  Status,
  TextInput
} from '@phoenix/ui'
import type {
  GalaxyCommodityMarketsResponse,
  GalaxyExplorationTargetsResponse,
  GalaxyFactionPresencesResponse,
  GalaxyFilteredSystemsResponse,
  GalaxyNearbySystemsResponse,
  GalaxyNearestStationsResponse,
  GalaxyOutfittingResponse,
  GalaxyShipyardsResponse,
  GalaxyStationLookupResponse,
  GalaxyTradeOpportunitiesResponse
} from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { InformationRoute, PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import type { RuntimeStateSnapshot } from '../../application/runtime/runtime-state-store.js'
import { GALAXY_QUERY_CATALOGUE } from './galaxy-query-catalogue.js'
import type { GalaxyQueryDefinition, GalaxyQueryField } from './galaxy-query-catalogue.js'
import { PlottedRoute } from './plotted-route.js'
import { SystemSchematic, type CartographicSelection } from './system-schematic.js'
import type { GalaxyControllerSnapshot } from './use-galaxy-controller.js'

type GalaxyRoute = Extract<InformationRoute, { section: 'galaxy' }>

export function GalaxyPage({ api, controller, onNavigate, route, runtime }: {
  api: PhoenixApi
  controller: GalaxyControllerSnapshot
  onNavigate(route: PhoenixRoute): void
  route: GalaxyRoute
  runtime: RuntimeStateSnapshot
}) {
  if (route.view === 'database') return <QueryConsole api={api} onNavigate={onNavigate} route={route} runtime={runtime} />
  if (controller.status === 'loading' || controller.status === 'idle') return <GalaxyState title={route.view === 'route' ? 'Plotted route' : 'System schematic'} />
  if (controller.status === 'error') return <GalaxyState error={controller.error} title={route.view === 'route' ? 'Plotted route' : 'System schematic'} />
  if (route.view === 'route') {
    return controller.route
      ? <PlottedRoute route={controller.route} runtimeState={runtime.status === 'ready' ? runtime.state : undefined} />
      : <GalaxyState error="Navigation route unavailable." title="Plotted route" />
  }
  return controller.lookup
    ? <SystemView lookup={controller.lookup} onNavigate={onNavigate} route={route} />
    : <GalaxyState error="System cartography unavailable." title="System schematic" />
}

function SystemView({ lookup, onNavigate, route }: {
  lookup: NonNullable<GalaxyControllerSnapshot['lookup']>
  onNavigate(route: PhoenixRoute): void
  route: Extract<GalaxyRoute, { view: 'system' }>
}) {
  const [query, setQuery] = useState(route.systemName ?? lookup.system.name)
  useEffect(() => setQuery(route.systemName ?? lookup.system.name), [lookup.system.name, route.systemName])
  const selected = useMemo<CartographicSelection | null>(() => {
    if (!route.selectedName) return null
    return lookup.system.bodies.find(item => item.name === route.selectedName)
      ?? lookup.system.stations.find(item => item.name === route.selectedName)
      ?? null
  }, [lookup.system, route.selectedName])

  return (
    <PageFrame className="galaxy-system-page" layout="fit">
      <PageHeader
        variant="cockpit"
        context={<Breadcrumbs items={[{ label: 'Galaxy' }, { label: lookup.system.name }]} />}
        status={`${lookup.system.source.provider.toUpperCase()} · ${lookup.cache} · ${formatTimestamp(lookup.system.source.fetchedAt)}`}
        title={lookup.system.name}
        actions={
          <form
            className="system-query"
            onSubmit={event => {
              event.preventDefault()
              const systemName = query.trim()
              if (systemName) onNavigate({ kind: 'information', section: 'galaxy', view: 'system', systemName })
            }}
          >
            <Field htmlFor="system-query-name" label="System name">
              <TextInput spellCheck="false" value={query} onChange={event => setQuery(event.target.value)} />
            </Field>
            <Button variant="accent" type="submit">Load</Button>
          </form>
        }
      />
      <SystemSchematic
        onSelect={selectedName => onNavigate({
          kind: 'information',
          section: 'galaxy',
          view: 'system',
          systemName: lookup.system.name,
          ...(selectedName ? { selectedName } : {})
        })}
        selected={selected}
        system={lookup.system}
      />
    </PageFrame>
  )
}

function QueryConsole({ api, onNavigate, route, runtime }: {
  api: PhoenixApi
  onNavigate(route: PhoenixRoute): void
  route: Extract<GalaxyRoute, { view: 'database' }>
  runtime: RuntimeStateSnapshot
}) {
  const selected = route.selectedQueryId
    ? GALAXY_QUERY_CATALOGUE.find(query => query.id === route.selectedQueryId)
    : undefined
  if (selected) {
    if (selected.id === 'filtered-systems') {
      return <FilteredSystemSearch
        api={api}
        defaultOrigin={runtime.status === 'ready' ? runtime.state.system.name ?? '' : ''}
        onBack={() => onNavigate({ kind: 'information', section: 'galaxy', view: 'database' })}
      />
    }
    return <GalaxyQueryEditor
      api={api}
      defaultOrigin={runtime.status === 'ready' ? runtime.state.system.name ?? '' : ''}
      definition={selected as GalaxyQueryDefinition & { id: Exclude<GalaxyQueryDefinition['id'], 'filtered-systems'> }}
      onBack={() => onNavigate({ kind: 'information', section: 'galaxy', view: 'database' })}
    />
  }
  return (
    <PageFrame layout="fit">
      <div className="query-console">
        <PageHeader variant="cockpit" context={<Breadcrumbs items={[{ label: 'Galaxy' }, { label: 'Query console' }]} />} title="Query console" />
        <div className="query-grid">
          {GALAXY_QUERY_CATALOGUE.map(query => (
            <ActionTile
              description={query.purpose}
              eyebrow={query.domain}
              key={query.id}
              label={query.title}
              onClick={() => onNavigate({ kind: 'information', section: 'galaxy', view: 'database', selectedQueryId: query.id })}
            />
          ))}
        </div>
      </div>
    </PageFrame>
  )
}

type GalaxyQueryResult =
  | { id: 'commodity-markets', value: GalaxyCommodityMarketsResponse }
  | { id: 'facilities', value: GalaxyNearestStationsResponse }
  | { id: 'exploration-targets', value: GalaxyExplorationTargetsResponse }
  | { id: 'faction-presence', value: GalaxyFactionPresencesResponse }
  | { id: 'nearby-systems', value: GalaxyNearbySystemsResponse }
  | { id: 'outfitting-stock', value: GalaxyOutfittingResponse }
  | { id: 'shipyards', value: GalaxyShipyardsResponse }
  | { id: 'station-lookup', value: GalaxyStationLookupResponse }
  | { id: 'trade-opportunities', value: GalaxyTradeOpportunitiesResponse }

function GalaxyQueryEditor({ api, defaultOrigin, definition, onBack }: {
  api: PhoenixApi
  defaultOrigin: string
  definition: GalaxyQueryDefinition & { id: Exclude<GalaxyQueryDefinition['id'], 'filtered-systems'> }
  onBack(): void
}) {
  const initial = () => ({ ...definition.defaults, origin: defaultOrigin || definition.defaults.origin || '' })
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [result, setResult] = useState<GalaxyQueryResult>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const execute = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(undefined)
    try {
      setResult(await executeGalaxyQuery(api, definition.id, values))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Galaxy query failed.')
    } finally {
      setLoading(false)
    }
  }
  return (
    <PageFrame layout="fit">
      <div className="filtered-system-search">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Galaxy' }, { label: 'Query console' }]} />}
          status={result ? resultStatus(result) : 'Community reports may be incomplete or stale'}
          title={definition.title}
        />
        {result
          ? <GalaxyQueryResults onEdit={() => setResult(undefined)} result={result} />
          : <ControlContext context="panel">
              <Form onSubmit={execute}>
                <div className="query-workspace">
                  <aside className="query-envelope" aria-label="Current query">
                    <header><small>{definition.domain}</small><strong>{definition.title}</strong><p>from {values.origin || 'an unresolved system'}</p></header>
                    <dl><div><dt>Parameters</dt><dd>{definition.fields.length}</dd></div><div><dt>Data source</dt><dd>Community intelligence</dd></div></dl>
                    <p>{definition.purpose}</p>
                  </aside>
                  <div className="query-parameters">
                    <div className="query-fields">
                      <FormSection title="Query parameters" description={definition.purpose}>
                        <FormGrid>{definition.fields.map(field => <CatalogueField field={field} key={field.id} value={values[field.id] ?? ''} onChange={value => setValues(current => ({ ...current, [field.id]: value }))} />)}</FormGrid>
                      </FormSection>
                      {error && <Status tone="danger">{error}</Status>}
                    </div>
                    <FormActions className="query-actions" layout="columns">
                      <FormActionGroup columns="two"><Button alignment="start" variant="outline" size="lg" type="button" onClick={onBack}>Back</Button><Button alignment="start" variant="outline" size="lg" type="button" onClick={() => setValues(initial())}>Reset query</Button></FormActionGroup>
                      <Button alignment="start" variant="accent" size="lg" type="submit" disabled={loading}>{loading ? 'Executing…' : 'Execute query'}</Button>
                    </FormActions>
                  </div>
                </div>
              </Form>
            </ControlContext>}
      </div>
    </PageFrame>
  )
}

function CatalogueField({ field, onChange, value }: { field: GalaxyQueryField, onChange(value: string): void, value: string }) {
  const control = field.type === 'select'
    ? <Select required={field.required} value={value} onChange={event => onChange(event.target.value)}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
    : field.type === 'number'
      ? <NumberInput max={field.max} min={field.min} required={field.required} value={value} onChange={event => onChange(event.target.value)} />
      : <TextInput placeholder={field.placeholder} required={field.required} value={value} onChange={event => onChange(event.target.value)} />
  return <Field htmlFor={`query-${field.id}`} label={field.label} required={field.required}>{control}</Field>
}

async function executeGalaxyQuery(api: PhoenixApi, id: Exclude<GalaxyQueryDefinition['id'], 'filtered-systems'>, values: Record<string, string>): Promise<GalaxyQueryResult> {
  switch (id) {
    case 'nearby-systems': return { id, value: await api.findGalaxyNearbySystems({ maxDistance: numeric(values.radius), systemName: values.origin ?? '' }) }
    case 'shipyards': return { id, value: await api.findGalaxyShipyards({ hullName: values.hull ?? '', systemName: values.origin ?? '' }) }
    case 'facilities': return { id, value: await api.findGalaxyNearestStations({ minimumPadSize: pad(values.pad), service: values.service ?? '', systemName: values.origin ?? '' }) }
    case 'commodity-markets': return { id, value: await api.findGalaxyCommodityMarkets({ commodity: values.commodity ?? '', intent: values.intent === 'buy' ? 'buy' : 'sell', maxDaysAgo: numeric(values.maxDaysAgo), maxDistance: numeric(values.maxDistance), minVolume: numeric(values.minVolume), systemName: values.origin ?? '' }) }
    case 'outfitting-stock': return { id, value: await api.findGalaxyOutfitting({ maxDaysAgo: numeric(values.maxDaysAgo), maxDistance: numeric(values.maxDistance), minimumPadSize: pad(values.pad), module: values.module ?? '', systemName: values.origin ?? '' }) }
    case 'station-lookup': return { id, value: await api.findGalaxyStations({ maxDistance: numeric(values.radius), minimumPadSize: pad(values.pad), name: values.name ?? '', stationType: stationType(values.stationType), systemName: values.origin ?? '' }) }
    case 'faction-presence': return { id, value: await api.findGalaxyFactionPresences({ allegiance: selection(values.allegiance), controlling: controlling(values.controlling), factionName: values.faction ?? '', government: selection(values.government), maxDistance: numeric(values.maxDistance), minInfluence: numeric(values.minInfluence), state: selection(values.state), systemName: values.origin ?? '' }) }
    case 'trade-opportunities': return { id, value: await api.findGalaxyTradeOpportunities({ availableCredits: numeric(values.availableCredits) ?? 0, cargoCapacity: numeric(values.cargoCapacity) ?? 0, maxDaysAgo: numeric(values.maxDaysAgo), maxDistance: numeric(values.maxDistance), minVolume: numeric(values.minVolume), systemName: values.origin ?? '' }) }
    case 'exploration-targets': return { id, value: await api.findGalaxyExplorationTargets({ atmosphere: text(values.atmosphere), bodyType: text(values.bodyType), landable: landable(values.landable), maxDistance: numeric(values.maxDistance), maxGravityG: decimal(values.maxGravityG), maxTemperatureK: decimal(values.maxTemperatureK), minBiologicalSignals: numeric(values.minBiologicalSignals), minGeologicalSignals: numeric(values.minGeologicalSignals), minGravityG: decimal(values.minGravityG), minTemperatureK: decimal(values.minTemperatureK), systemName: values.origin ?? '', volcanism: text(values.volcanism) }) }
  }
}

function GalaxyQueryResults({ onEdit, result }: { onEdit(): void, result: GalaxyQueryResult }) {
  const rows = resultRows(result)
  return (
    <DataTableGroup className="query-results" title="Query results" meta={`${rows.length} results`}>
      <Button variant="outline" type="button" onClick={onEdit}>Change query</Button>
      <DataTable density="compact" label="Galaxy query results" minimum="wide" scheme="surface" stickyHeader>
        <thead><tr><th>Result</th><th>System</th><th className="numeric">Distance</th><th>Details</th><th>Reported</th></tr></thead>
        <tbody>{rows.length === 0 ? <tr><td colSpan={5}>No matching community reports.</td></tr> : rows.map((row, index) => <tr key={`${row.system}:${row.name}:${index}`}><td>{row.name}</td><td>{row.system}</td><td className="numeric">{row.distance}</td><td>{row.details}</td><td>{row.reported}</td></tr>)}</tbody>
      </DataTable>
    </DataTableGroup>
  )
}

type ResultRow = { name: string, system: string, distance: string, details: string, reported: string }
function resultRows(result: GalaxyQueryResult): ResultRow[] {
  const row = (name: string, system: string, distanceValue: number | null, details: string, updatedAt: string | null): ResultRow => ({ name, system, distance: distanceValue === null ? '—' : `${distanceValue.toFixed(1)} ly`, details, reported: updatedAt ? formatTimestamp(updatedAt) : 'Unknown' })
  switch (result.id) {
    case 'nearby-systems': return result.value.systems.map(item => row(item.systemName, item.systemName, item.distanceLy, coordinates(item.position), item.updatedAt))
    case 'shipyards': return result.value.shipyards.map(item => row(item.stationName, item.systemName, item.distanceLy, `${item.stationType ?? 'Shipyard'} · ${credits(item.price)}`, item.updatedAt))
    case 'facilities': return result.value.stations.map(item => row(item.stationName, item.systemName, item.distanceLy, `${item.stationType ?? 'Station'} · ${padLabel(item.maxLandingPadSize)} pad`, item.updatedAt))
    case 'commodity-markets': return result.value.markets.map(item => row(item.stationName, item.systemName, item.distanceLy, `${result.value.intent === 'buy' ? credits(item.buyPrice) : credits(item.sellPrice)} · ${item.commodityName}`, item.updatedAt))
    case 'outfitting-stock': return result.value.matches.map(item => row(item.stationName, item.systemName, item.distanceLy, `${item.moduleClass ?? ''}${item.moduleRating ?? ''} ${item.moduleName}`.trim(), item.updatedAt))
    case 'station-lookup': return result.value.matches.map(item => row(item.stationName, item.systemName, item.distanceLy, item.services.join(', ') || item.stationType || 'Station', item.updatedAt))
    case 'faction-presence': return result.value.presences.map(item => row(item.factionName, item.systemName, item.distanceLy, `${item.influencePercent.toFixed(1)}% · ${item.state ?? 'Unknown state'}`, item.updatedAt))
    case 'trade-opportunities': return result.value.opportunities.map(item => row(item.commodityName, item.sellMarket.systemName, item.travelDistanceLy, `${credits(item.projectedProfit)} projected · ${item.units} t`, item.sellMarket.updatedAt))
    case 'exploration-targets': return result.value.targets.map(item => row(item.bodyName, item.systemName, item.distanceLy, `${item.subtype ?? item.bodyType ?? 'Body'} · ${item.biologicalSignals} bio / ${item.geologicalSignals} geo`, item.signalsUpdatedAt ?? item.providerUpdatedAt))
  }
}

function resultStatus(result: GalaxyQueryResult): string { return `${result.value.cache} · ${resultRows(result).length} results` }
function numeric(value?: string): number | undefined { return value?.trim() ? Number.parseInt(value, 10) : undefined }
function decimal(value?: string): number | undefined { return value?.trim() ? Number(value) : undefined }
function text(value?: string): string | undefined { return value?.trim() || undefined }
function selection(value?: string): string | undefined { return value && value !== 'any' ? value : undefined }
function pad(value?: string): 'large' | 'medium' | 'small' | undefined { return value === 'large' || value === 'medium' || value === 'small' ? value : undefined }
function stationType(value?: string): 'any' | 'carrier' | 'orbital' | 'surface' | undefined { return value === 'carrier' || value === 'orbital' || value === 'surface' ? value : 'any' }
function controlling(value?: string): 'any' | 'yes' | 'no' { return value === 'yes' || value === 'no' ? value : 'any' }
function landable(value?: string): 'any' | 'yes' | 'no' { return value === 'yes' || value === 'no' ? value : 'any' }
function coordinates(value: [number, number, number]): string { return value.map(axis => axis.toFixed(2)).join(' · ') }
function credits(value: number | null): string { return value === null ? '—' : `${value.toLocaleString()} CR` }
function padLabel(value: number | null): string { return value === 3 ? 'Large' : value === 2 ? 'Medium' : value === 1 ? 'Small' : 'Unknown' }

type FilterValues = {
  allegiance: string
  economy: string
  government: string
  maxDistance: string
  maxPopulation: string
  minPopulation: string
  origin: string
  population: 'any' | 'inhabited' | 'uninhabited'
  security: string
}

function FilteredSystemSearch({ api, defaultOrigin, onBack }: {
  api: PhoenixApi
  defaultOrigin: string
  onBack(): void
}) {
  const initial = (): FilterValues => ({
    allegiance: 'any', economy: 'any', government: 'any', maxDistance: '100', maxPopulation: '',
    minPopulation: '', origin: defaultOrigin, population: 'any', security: 'any'
  })
  const [values, setValues] = useState<FilterValues>(initial)
  const [result, setResult] = useState<GalaxyFilteredSystemsResponse>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const set = (key: keyof FilterValues, value: string) => setValues(current => ({ ...current, [key]: value }))
  const execute = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(undefined)
    try {
      setResult(await api.getFilteredSystems({
        system: values.origin.trim(),
        maxDistance: Number(values.maxDistance),
        population: values.population,
        ...(values.minPopulation ? { minPopulation: Number(values.minPopulation) } : {}),
        ...(values.maxPopulation ? { maxPopulation: Number(values.maxPopulation) } : {}),
        ...(values.economy !== 'any' ? { economy: values.economy } : {}),
        ...(values.allegiance !== 'any' ? { allegiance: values.allegiance } : {}),
        ...(values.government !== 'any' ? { government: values.government } : {}),
        ...(values.security !== 'any' ? { security: values.security } : {})
      }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Galaxy query failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageFrame layout="fit">
      <div className="filtered-system-search">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Galaxy' }, { label: 'Query console' }]} />}
          status={result ? `${result.cache} · ${result.systems.length} results` : 'Community reports may be incomplete or stale'}
          title="Filtered system search"
        />
        {result
          ? <FilteredSystemResults onEdit={() => setResult(undefined)} result={result} />
          : <ControlContext context="panel">
              <Form onSubmit={execute}>
                <div className="query-workspace">
                  <aside className="query-envelope" aria-label="Current search envelope">
                    <header><small>Search envelope</small><strong>{values.maxDistance || '—'} <span>LY</span></strong><p>from {values.origin || 'an unresolved system'}</p></header>
                    <dl>
                      <div><dt>Population</dt><dd>{values.population}</dd></div>
                      <div><dt>Profile filters</dt><dd>{[values.economy, values.allegiance, values.government, values.security].every(value => value === 'any') ? 'Unrestricted' : 'Restricted'}</dd></div>
                      <div><dt>Data source</dt><dd>Community cartography</dd></div>
                    </dl>
                    <p>Results are ordered by distance from the reference system. Unknown values remain visible.</p>
                  </aside>
                  <div className="query-parameters">
                    <div className="query-fields">
                      <FormSection title="Search volume" description="Set the origin, reach, and inhabited-state boundary.">
                        <FormGrid>
                          <Field htmlFor="query-reference-system" label="Reference system" required><TextInput required value={values.origin} onChange={event => set('origin', event.target.value)} /></Field>
                          <Field htmlFor="query-maximum-distance" label="Maximum distance"><NumberInput min={1} max={500} required value={values.maxDistance} onChange={event => set('maxDistance', event.target.value)} /></Field>
                          <Field htmlFor="query-population" label="Population"><Select value={values.population} onChange={event => set('population', event.target.value)}><option value="any">Any population</option><option value="inhabited">Inhabited systems</option><option value="uninhabited">Uninhabited systems</option></Select></Field>
                          <Field htmlFor="query-minimum-population" label="Minimum population"><NumberInput min={0} value={values.minPopulation} onChange={event => set('minPopulation', event.target.value)} /></Field>
                          <Field htmlFor="query-maximum-population" label="Maximum population"><NumberInput min={0} value={values.maxPopulation} onChange={event => set('maxPopulation', event.target.value)} /></Field>
                        </FormGrid>
                      </FormSection>
                      <FormSection title="System profile" description="Leave fields unrestricted to broaden the search.">
                        <FormGrid>
                          <ProfileSelect id="economy" label="Primary economy" value={values.economy} values={['Agriculture', 'Extraction', 'High Tech', 'Industrial', 'Service']} onChange={value => set('economy', value)} />
                          <ProfileSelect id="allegiance" label="Allegiance" value={values.allegiance} values={['Alliance', 'Empire', 'Federation', 'Independent']} onChange={value => set('allegiance', value)} />
                          <ProfileSelect id="government" label="Government" value={values.government} values={['Anarchy', 'Corporate', 'Democracy', 'Dictatorship']} onChange={value => set('government', value)} />
                          <ProfileSelect id="security" label="Security" value={values.security} values={['Anarchy', 'Low', 'Medium', 'High']} onChange={value => set('security', value)} />
                        </FormGrid>
                      </FormSection>
                      {error && <Status tone="danger">{error}</Status>}
                    </div>
                    <FormActions className="query-actions" layout="columns">
                      <FormActionGroup columns="two"><Button alignment="start" variant="outline" size="lg" type="button" onClick={onBack}>Back</Button><Button alignment="start" variant="outline" size="lg" type="button" onClick={() => setValues(initial())}>Reset filters</Button></FormActionGroup>
                      <Button alignment="start" variant="accent" size="lg" type="submit" disabled={loading}>{loading ? 'Executing…' : 'Execute query'}</Button>
                    </FormActions>
                  </div>
                </div>
              </Form>
            </ControlContext>}
      </div>
    </PageFrame>
  )
}

function ProfileSelect({ id, label, onChange, value, values }: { id: string, label: string, onChange(value: string): void, value: string, values: string[] }) {
  return <Field htmlFor={`query-${id}`} label={label}><Select value={value} onChange={event => onChange(event.target.value)}><option value="any">Any {label.toLocaleLowerCase()}</option>{values.map(item => <option key={item} value={item}>{item}</option>)}</Select></Field>
}

function FilteredSystemResults({ onEdit, result }: { onEdit(): void, result: GalaxyFilteredSystemsResponse }) {
  return (
    <DataTableGroup className="query-results" title="Matching systems" meta={`${result.systems.length} results`}>
      <Button variant="outline" type="button" onClick={onEdit}>Change query</Button>
      <DataTable density="compact" label="Filtered system search results" minimum="wide" scheme="surface" stickyHeader>
        <thead><tr><th>System</th><th className="numeric">Distance</th><th>Economy</th><th>Government</th><th>Security</th><th className="numeric">Population</th></tr></thead>
        <tbody>{result.systems.length === 0
          ? <tr><td colSpan={6}>No matching systems reported.</td></tr>
          : result.systems.map(system => <tr key={system.systemAddress ?? system.systemName}><td>{system.systemName}</td><td className="numeric">{system.distanceLy.toFixed(1)} ly</td><td>{system.economy ?? '—'}</td><td>{system.government ?? '—'}</td><td>{system.security ?? '—'}</td><td className="numeric">{system.population.toLocaleString()}</td></tr>)}</tbody>
      </DataTable>
    </DataTableGroup>
  )
}

function GalaxyState({ error, title }: { error?: string, title: string }) {
  return (
    <PageFrame layout="fit">
      <PageHeader variant="cockpit" title={title} />
      <Status tone={error ? 'danger' : 'muted'}>{error ?? `Loading ${title.toLocaleLowerCase()}…`}</Status>
    </PageFrame>
  )
}

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp))
}
