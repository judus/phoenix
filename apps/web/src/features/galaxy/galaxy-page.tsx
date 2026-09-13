import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  ActionTile,
  Breadcrumbs,
  Button,
  ControlContext,
  Field,
  Form,
  FormActionGroup,
  FormActions,
  FormGrid,
  IconButton,
  MultiSelect,
  NumberInput,
  PageFrame,
  PageHeader,
  Select,
  Status,
  TextInput
} from '@phoenix/ui'
import type { PlotEliteDestinationResult, SavedGalaxyQuery } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { InformationRoute, PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import type { RuntimeStateSnapshot } from '../../application/runtime/runtime-state-store.js'
import { GALAXY_QUERY_CATALOGUE } from './galaxy-query-catalogue.js'
import type { GalaxyQueryDefinition, GalaxyQueryField, GalaxyQueryValue } from './galaxy-query-catalogue.js'
import { GalaxyQueryResults, galaxyQueryResultCount, type GalaxyQueryResult } from './galaxy-query-results.js'
import type { GalaxyQuerySessionStore } from './galaxy-query-session-store.js'
import { PlottedRoute } from './plotted-route.js'
import { ExobiologyPage } from './exobiology-page.js'
import { SystemSchematic, type CartographicSelection } from './system-schematic.js'
import { BookmarksPage } from './bookmarks-page.js'
import { SavedGalaxyQueriesPage } from './saved-galaxy-queries-page.js'
import { useSystemBookmarkStatus } from './use-system-bookmark-status.js'
import type { GalaxyControllerSnapshot } from './use-galaxy-controller.js'

type GalaxyRoute = Extract<InformationRoute, { section: 'galaxy' }>

export function GalaxyPage({ api, controller, onNavigate, querySessions, route, runtime }: {
  api: PhoenixApi
  controller: GalaxyControllerSnapshot
  onNavigate(route: PhoenixRoute): void
  querySessions: GalaxyQuerySessionStore
  route: GalaxyRoute
  runtime: RuntimeStateSnapshot
}) {
  if (route.view === 'database') return <QueryConsole api={api} onNavigate={onNavigate} querySessions={querySessions} route={route} runtime={runtime} />
  if (route.view === 'saved-queries') return <SavedGalaxyQueriesPage api={api} onNavigate={onNavigate} />
  if (route.view === 'exobiology') return <ExobiologyPage controller={controller} />
  if (route.view === 'bookmarks') return <BookmarksPage api={api} onNavigate={onNavigate} route={route} />
  if (controller.status === 'loading' || controller.status === 'idle') {
    return route.view === 'system'
      ? <SystemState api={api} onNavigate={onNavigate} route={route} runtime={runtime} />
      : <GalaxyState title="Plotted route" />
  }
  if (controller.status === 'error') {
    return route.view === 'system'
      ? <SystemState api={api} error={controller.error} onNavigate={onNavigate} route={route} runtime={runtime} />
      : <GalaxyState error={controller.error} title="Plotted route" />
  }
  if (route.view === 'route') {
    return controller.route
      ? <PlottedRoute actions={controller.actions} api={api} route={controller.route} runtimeState={runtime.status === 'ready' ? runtime.state : undefined} />
      : <GalaxyState error="Navigation route unavailable." title="Plotted route" />
  }
  return controller.lookup
    ? <SystemView
        api={api}
        commanderName={runtime.status === 'ready' ? runtime.state.commander.name : null}
        lookup={controller.lookup}
        onNavigate={onNavigate}
        route={route}
      />
    : <SystemState api={api} error="System cartography unavailable." onNavigate={onNavigate} route={route} runtime={runtime} />
}

function SystemView({ api, commanderName, lookup, onNavigate, route }: {
  api: PhoenixApi
  commanderName: string | null
  lookup: NonNullable<GalaxyControllerSnapshot['lookup']>
  onNavigate(route: PhoenixRoute): void
  route: Extract<GalaxyRoute, { view: 'system' }>
}) {
  const following = route.systemName === undefined
  const [query, setQuery] = useState(route.systemName ?? lookup.system.name)
  const [plotting, setPlotting] = useState(false)
  const [plotResult, setPlotResult] = useState<PlotEliteDestinationResult>()
  const plotAbort = useRef<AbortController | null>(null)
  const systemBookmarked = useSystemBookmarkStatus(api, lookup.system.name)
  useEffect(() => setQuery(route.systemName ?? lookup.system.name), [lookup.system.name, route.systemName])
  useEffect(() => {
    setPlotting(false)
    setPlotResult(undefined)
    return () => {
      plotAbort.current?.abort()
      plotAbort.current = null
    }
  }, [lookup.system.name])
  const selected = useMemo<CartographicSelection | null>(() => {
    if (!route.selectedName) return null
    return lookup.system.bodies.find(item => item.name === route.selectedName)
      ?? lookup.system.stations.find(item => item.name === route.selectedName)
      ?? null
  }, [lookup.system, route.selectedName])

  const plotRoute = () => {
    const controller = new AbortController()
    plotAbort.current = controller
    setPlotting(true)
    setPlotResult(undefined)
    void api.plotEliteDestination(lookup.system.name, controller.signal)
      .then(result => {
        if (plotAbort.current === controller) {
          setPlotResult(result)
          if (result.status === 'confirmed') {
            onNavigate({ kind: 'information', section: 'galaxy', view: 'route' })
          }
        }
      })
      .catch(cause => {
        if (plotAbort.current === controller) {
          setPlotResult({
            requestedSystem: lookup.system.name,
            confirmedSystem: null,
            status: 'failed',
            phase: 'preflight',
            message: cause instanceof Error ? cause.message : 'Galaxy Map automation failed.'
          })
        }
      })
      .finally(() => {
        if (plotAbort.current === controller) {
          plotAbort.current = null
          setPlotting(false)
        }
      })
  }

  return (
    <PageFrame className="galaxy-system-page" layout="fit">
      <SystemHeader
        bookmarked={systemBookmarked}
        following={following}
        onBookmark={() => onNavigate({ kind: 'information', section: 'galaxy', view: 'bookmarks', systemName: lookup.system.name })}
        onFollow={() => onNavigate({
          kind: 'information',
          section: 'galaxy',
          view: 'system',
          ...(following ? { systemName: lookup.system.name } : {})
        })}
        onLoad={systemName => onNavigate({ kind: 'information', section: 'galaxy', view: 'system', systemName })}
        onPlot={plotRoute}
        plotResult={plotResult}
        plotting={plotting}
        query={query}
        setQuery={setQuery}
        systemName={lookup.system.name}
      />
      <SystemSchematic
        commanderName={commanderName}
        onBookmarkBody={bodyName => onNavigate({ kind: 'information', section: 'galaxy', view: 'bookmarks', systemName: lookup.system.name, bodyName })}
        onSelect={selectedName => onNavigate({
          kind: 'information',
          section: 'galaxy',
          view: 'system',
          ...(route.systemName ? { systemName: lookup.system.name } : {}),
          ...(selectedName ? { selectedName } : {})
        })}
        selected={selected}
        system={lookup.system}
      />
    </PageFrame>
  )
}

function SystemState({ api, error, onNavigate, route, runtime }: {
  api: PhoenixApi
  error?: string
  onNavigate(route: PhoenixRoute): void
  route: Extract<GalaxyRoute, { view: 'system' }>
  runtime: RuntimeStateSnapshot
}) {
  const following = route.systemName === undefined
  const currentSystemName = runtime.status === 'ready' ? runtime.state.system.name : null
  const systemName = route.systemName ?? currentSystemName
  const [query, setQuery] = useState(systemName ?? '')
  const systemBookmarked = useSystemBookmarkStatus(api, systemName ?? '')
  useEffect(() => setQuery(systemName ?? ''), [systemName])

  return (
    <PageFrame className="galaxy-system-page" layout="fit">
      <SystemHeader
        bookmarked={systemBookmarked}
        following={following}
        onBookmark={systemName ? () => onNavigate({ kind: 'information', section: 'galaxy', view: 'bookmarks', systemName }) : undefined}
        onFollow={() => {
          if (following && !systemName) return
          onNavigate({
            kind: 'information',
            section: 'galaxy',
            view: 'system',
            ...(following ? { systemName: systemName! } : {})
          })
        }}
        onLoad={name => onNavigate({ kind: 'information', section: 'galaxy', view: 'system', systemName: name })}
        query={query}
        setQuery={setQuery}
        systemName={systemName ?? 'System schematic'}
      />
      <div className="system-schematic__state">
        <Status tone="muted">{error ?? 'Loading system schematic…'}</Status>
      </div>
    </PageFrame>
  )
}

function SystemHeader({ bookmarked = false, following, onBookmark, onFollow, onLoad, onPlot, plotResult, plotting = false, query, setQuery, systemName }: {
  bookmarked?: boolean
  following: boolean
  onBookmark?: () => void
  onFollow(): void
  onLoad(systemName: string): void
  onPlot?: () => void
  plotResult?: PlotEliteDestinationResult
  plotting?: boolean
  query: string
  setQuery(query: string): void
  systemName: string
}) {
  return (
    <PageHeader
      variant="cockpit"
      context={<Breadcrumbs items={[{ label: 'Galaxy', href: '#/galaxy/system' }, { label: 'System schematic' }]} />}
      title={systemName}
      actions={
        <form
          className="system-query"
          onSubmit={event => {
            event.preventDefault()
            const name = query.trim()
            if (name) onLoad(name)
          }}
        >
          {plotResult && (
            <Status className="system-query__status" tone={plotResult.status === 'confirmed' ? 'positive' : 'danger'} wrap>
              {plotResult.status === 'confirmed' ? plotResult.message : `${destinationPhaseLabel(plotResult.phase)}: ${plotResult.message}`}
            </Status>
          )}
          <div className="system-query__controls">
            <label className="sr-only" htmlFor="system-query-name">System name</label>
            <TextInput
              className="system-query__input"
              id="system-query-name"
              spellCheck="false"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
            <IconButton
              className="system-query__action"
              label="Load system"
              size="sm"
              type="submit"
              variant="accent"
            >
              <LoadSystemIcon />
            </IconButton>
            <IconButton
              aria-pressed={following}
              className={`system-query__action system-query__toggle btn-toggle${following ? ' active' : ''}`}
              label={following ? 'Stop following current system' : 'Follow current system'}
              size="sm"
              type="button"
              onClick={onFollow}
            >
              <FollowSystemIcon />
            </IconButton>
            <IconButton
              aria-pressed={bookmarked}
              className={`system-query__action system-query__toggle btn-toggle${bookmarked ? ' active' : ''}`}
              disabled={!onBookmark}
              label={bookmarked ? `Edit bookmark for ${systemName}` : `Bookmark ${systemName}`}
              size="sm"
              type="button"
              onClick={onBookmark}
            >
              <BookmarkIcon />
            </IconButton>
            <IconButton
              aria-busy={plotting || undefined}
              className="system-query__action"
              disabled={!onPlot || plotting}
              label={plotting ? 'Plotting route…' : 'Plot route'}
              size="sm"
              type="button"
              variant="accent"
              onClick={onPlot}
            >
              <PlotRouteIcon />
            </IconButton>
          </div>
        </form>
      }
    />
  )
}

function LoadSystemIcon () {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 12h13m-5-5 5 5-5 5M20 4v16" /></svg>
}

function BookmarkIcon () {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 3h14v18l-7-5-7 5V3Z" /></svg>
}

function FollowSystemIcon () {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></svg>
}

function PlotRouteIcon () {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="5" cy="18" r="2" /><circle cx="19" cy="6" r="2" /><path d="M7 18h4a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h8" /></svg>
}

function destinationPhaseLabel (phase: PlotEliteDestinationResult['phase']): string {
  return {
    preflight: 'Preflight',
    open_map: 'Opening Galaxy Map',
    focus_search: 'Opening search',
    enter_destination: 'Entering destination',
    select_result: 'Selecting result',
    plot_route: 'Plotting route',
    confirm_route: 'Confirming route',
    close_map: 'Closing Galaxy Map'
  }[phase]
}

function QueryConsole({ api, onNavigate, querySessions, route, runtime }: {
  api: PhoenixApi
  onNavigate(route: PhoenixRoute): void
  querySessions: GalaxyQuerySessionStore
  route: Extract<GalaxyRoute, { view: 'database' }>
  runtime: RuntimeStateSnapshot
}) {
  const [savedQueries, setSavedQueries] = useState<SavedGalaxyQuery[]>()
  const [savedQueryError, setSavedQueryError] = useState<string>()
  useEffect(() => {
    if (!route.savedQueryId) return
    const controller = new AbortController()
    setSavedQueryError(undefined)
    void api.getSavedGalaxyQueries(controller.signal)
      .then(response => setSavedQueries(response.queries))
      .catch(cause => {
        if (!controller.signal.aborted) setSavedQueryError(cause instanceof Error ? cause.message : 'Saved queries unavailable.')
      })
    return () => controller.abort()
  }, [api, route.savedQueryId, route.selectedQueryId])
  const selected = route.selectedQueryId
    ? GALAXY_QUERY_CATALOGUE.find(query => query.id === route.selectedQueryId)
    : undefined
  if (selected) {
    const savedQuery = route.savedQueryId
      ? savedQueries?.find(query => query.id === route.savedQueryId)
      : undefined
    if (route.savedQueryId && !savedQueries) return <QueryConsoleState error={savedQueryError} />
    if (route.savedQueryId && (!savedQuery || savedQuery.queryId !== selected.id)) {
      return <QueryConsoleState error="That saved query no longer exists." />
    }
    return <GalaxyQueryEditor
      api={api}
      defaultOrigin={runtime.status === 'ready' ? runtime.state.system.name ?? '' : ''}
      definition={selected}
      executionId={route.savedQueryRunId}
      key={`${selected.id}:${savedQuery?.id ?? 'new'}`}
      onBack={() => onNavigate({ kind: 'information', section: 'galaxy', view: savedQuery ? 'saved-queries' : 'database' })}
      onSaved={saved => {
        setSavedQueries(current => [saved, ...(current ?? []).filter(query => query.id !== saved.id)])
        onNavigate({ kind: 'information', section: 'galaxy', view: 'database', savedQueryId: saved.id, selectedQueryId: saved.queryId })
      }}
      querySessions={querySessions}
      savedQuery={savedQuery}
    />
  }
  return (
    <PageFrame layout="fit">
      <div className="query-console">
        <PageHeader variant="cockpit" context={<Breadcrumbs items={[{ label: 'Galaxy', href: '#/galaxy/system' }, { label: 'Query console' }]} />} title="Query console" />
        <div className="query-grid">
          {GALAXY_QUERY_CATALOGUE.map(query => (
            <ActionTile
              description={query.purpose}
              key={query.id}
              label={query.title}
              status={query.domain}
              onClick={() => onNavigate({ kind: 'information', section: 'galaxy', view: 'database', selectedQueryId: query.id })}
            />
          ))}
          <ActionTile
            description="Run and manage reusable galaxy queries."
            label="Saved queries"
            status="Query library"
            onClick={() => onNavigate({ kind: 'information', section: 'galaxy', view: 'saved-queries' })}
          />
        </div>
      </div>
    </PageFrame>
  )
}

function GalaxyQueryEditor({ api, defaultOrigin, definition, executionId, onBack, onSaved, querySessions, savedQuery }: {
  api: PhoenixApi
  defaultOrigin: string
  definition: GalaxyQueryDefinition
  executionId?: string
  onBack(): void
  onSaved(query: SavedGalaxyQuery): void
  querySessions: GalaxyQuerySessionStore
  savedQuery?: SavedGalaxyQuery
}) {
  const sessionId = savedQuery?.id ?? definition.id
  const retained = querySessions.get(sessionId)
  const executeOnMount = executionId !== undefined && retained?.executionId !== executionId
  const initial = (): Record<string, GalaxyQueryValue> => retained
    ? { ...retained.values }
    : queryValues(definition, savedQuery?.parameters, defaultOrigin)
  const [values, setValues] = useState<Record<string, GalaxyQueryValue>>(initial)
  const [result, setResult] = useState<GalaxyQueryResult | undefined>(executeOnMount ? undefined : retained?.result)
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedName, setSavedName] = useState(savedQuery?.name ?? '')
  const automaticExecutionStarted = useRef(false)
  const runQuery = async (nextValues: Record<string, GalaxyQueryValue>) => {
    setLoading(true)
    setError(undefined)
    try {
      const nextResult = await executeGalaxyQuery(api, definition.id, nextValues)
      querySessions.set(sessionId, { ...(executionId ? { executionId } : {}), result: nextResult, values: nextValues })
      setResult(nextResult)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Galaxy query failed.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    if (!executeOnMount || automaticExecutionStarted.current) return
    automaticExecutionStarted.current = true
    void runQuery(values)
  }, [executeOnMount])
  const execute = (event: FormEvent) => {
    event.preventDefault()
    void runQuery(values)
  }
  const save = async () => {
    const name = savedName.trim()
    if (!name) return
    setSaving(true)
    setError(undefined)
    try {
      const saved = await api.saveGalaxyQuery({ name, parameters: values, queryId: definition.id }, savedQuery?.id)
      querySessions.set(saved.id, { ...(result ? { result } : {}), values })
      setSaveOpen(false)
      setSaving(false)
      onSaved(saved)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Query could not be saved.')
      setSaving(false)
    }
  }
  return (
    <PageFrame layout="fit">
      <div className="galaxy-query-editor">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Galaxy', href: '#/galaxy/system' }, { label: 'Query console', href: '#/galaxy/database' }]} />}
          status={result ? resultStatus(result) : 'Community reports may be incomplete or stale'}
          title={definition.title}
        />
        {result
          ? <GalaxyQueryResults actions={<Button variant="outline" type="button" onClick={() => setSaveOpen(true)}>{savedQuery ? 'Update saved query' : 'Save query'}</Button>} onEdit={() => {
              querySessions.set(sessionId, { values })
              setResult(undefined)
            }} result={result}>
              {saveOpen && <SaveQueryPanel error={error} name={savedName} saving={saving} onCancel={() => setSaveOpen(false)} onChange={setSavedName} onSave={() => void save()} />}
            </GalaxyQueryResults>
          : <ControlContext context="panel" density="compact">
              <Form onSubmit={execute}>
                <div className="query-workspace">
                  <aside className="query-envelope" aria-label="Current query">
                    <header><small>{definition.domain}</small><strong>{savedQuery?.name ?? definition.title}</strong><p>{savedQuery ? `${definition.title} · ` : ''}from {scalar(values.origin) || 'an unresolved system'}</p></header>
                    <dl><div><dt>Parameters</dt><dd>{definition.fields.length}</dd></div><div><dt>Data source</dt><dd>Community intelligence</dd></div></dl>
                    <p>{definition.purpose}</p>
                  </aside>
                  <div className="query-parameters">
                    <div className="query-fields">
                      <FormGrid>{definition.fields.map(field => <CatalogueField field={field} key={field.id} value={values[field.id] ?? ''} onChange={value => setValues(current => {
                        const next = { ...current, [field.id]: value }
                        querySessions.set(sessionId, { values: next })
                        return next
                      })} />)}</FormGrid>
                    </div>
                    {saveOpen && <SaveQueryPanel name={savedName} saving={saving} onCancel={() => setSaveOpen(false)} onChange={setSavedName} onSave={() => void save()} />}
                    <FormActions className="query-actions" layout="columns" message={error ? <Status tone="danger" wrap>{error}</Status> : undefined}>
                      <FormActionGroup columns="two"><Button alignment="start" variant="outline" size="lg" type="button" onClick={onBack}>Back</Button><Button alignment="start" variant="outline" size="lg" type="button" onClick={() => {
                        const reset = { ...definition.defaults, origin: defaultOrigin || scalar(definition.defaults.origin) }
                        querySessions.set(sessionId, { values: reset })
                        setValues(reset)
                      }}>Reset query</Button></FormActionGroup>
                      <FormActionGroup columns="two"><Button alignment="start" variant="outline" size="lg" type="button" onClick={() => setSaveOpen(true)}>{savedQuery ? 'Update saved query' : 'Save query'}</Button><Button alignment="start" variant="accent" size="lg" type="submit" disabled={loading}>{loading ? 'Executing…' : 'Execute query'}</Button></FormActionGroup>
                    </FormActions>
                  </div>
                </div>
              </Form>
            </ControlContext>}
      </div>
    </PageFrame>
  )
}

function SaveQueryPanel ({ error, name, onCancel, onChange, onSave, saving }: {
  error?: string
  name: string
  onCancel(): void
  onChange(value: string): void
  onSave(): void
  saving: boolean
}) {
  return <section className="save-query-panel">
    <Field htmlFor="saved-query-name" label="Saved query name" required>
      <TextInput autoFocus id="saved-query-name" maxLength={80} value={name} onChange={event => onChange(event.target.value)} />
    </Field>
    <div><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button busy={saving} disabled={!name.trim()} type="button" variant="primary" onClick={onSave}>Save</Button></div>
    {error && <Status tone="danger" wrap>{error}</Status>}
  </section>
}

function QueryConsoleState ({ error }: { error?: string }) {
  return <PageFrame><PageHeader variant="cockpit" context={<Breadcrumbs items={[{ label: 'Galaxy', href: '#/galaxy/system' }, { label: 'Query console' }]} />} title="Query console" /><Status tone={error ? 'danger' : 'muted'}>{error ?? 'Loading saved query…'}</Status></PageFrame>
}

function queryValues (definition: GalaxyQueryDefinition, parameters: SavedGalaxyQuery['parameters'] | undefined, defaultOrigin: string): Record<string, GalaxyQueryValue> {
  const values: Record<string, GalaxyQueryValue> = {
    ...definition.defaults,
    origin: defaultOrigin || scalar(definition.defaults.origin)
  }
  if (!parameters) return values
  const fields = new Map(definition.fields.map(field => [field.id, field]))
  for (const [key, value] of Object.entries(parameters)) {
    const field = fields.get(key)
    if (!field) continue
    if (field.type === 'multi-select' && Array.isArray(value)) values[key] = [...value]
    if (field.type !== 'multi-select' && typeof value === 'string') values[key] = value
  }
  return values
}

function CatalogueField({ field, onChange, value }: { field: GalaxyQueryField, onChange(value: GalaxyQueryValue): void, value: GalaxyQueryValue }) {
  const id = `query-${field.id}`
  const control = field.type === 'multi-select'
    ? <MultiSelect id={id} options={field.options ?? []} value={multiple(value)} onChange={onChange} />
    : field.type === 'select'
      ? <Select id={id} required={field.required} value={scalar(value)} onChange={event => onChange(event.target.value)}>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select>
    : field.type === 'number'
      ? <NumberInput id={id} max={field.max} min={field.min} required={field.required} value={scalar(value)} onChange={event => onChange(event.target.value)} />
      : <TextInput id={id} placeholder={field.placeholder} required={field.required} type={field.type === 'date' ? 'date' : 'text'} value={scalar(value)} onChange={event => onChange(event.target.value)} />
  return <Field htmlFor={id} hint={field.hint} label={field.label} required={field.required}>{control}</Field>
}

async function executeGalaxyQuery(api: PhoenixApi, id: GalaxyQueryDefinition['id'], values: Record<string, GalaxyQueryValue>): Promise<GalaxyQueryResult> {
  switch (id) {
    case 'system-search': return { id, value: await api.findGalaxySystems({
      allegiance: selection(values.allegiance),
      economy: selection(values.economy),
      government: selection(values.government),
      maxDistance: numeric(values.radius) ?? 100,
      maxPopulation: numeric(values.maxPopulation),
      minPopulation: numeric(values.minPopulation),
      population: population(values.population),
      security: selection(values.security),
      system: scalar(values.origin)
    }) }
    case 'shipyards': return { id, value: await api.findGalaxyShipyards({ hullName: scalar(values.hull), systemName: scalar(values.origin) }) }
    case 'facilities': return { id, value: await api.findGalaxyNearestStations({ minimumPadSize: pad(values.pad), service: scalar(values.service), systemName: scalar(values.origin) }) }
    case 'commodity-markets': return { id, value: await api.findGalaxyCommodityMarkets({ commodity: scalar(values.commodity), intent: scalar(values.intent) === 'buy' ? 'buy' : 'sell', maxDaysAgo: numeric(values.maxDaysAgo), maxDistance: numeric(values.maxDistance), minVolume: numeric(values.minVolume), systemName: scalar(values.origin) }) }
    case 'outfitting-stock': return { id, value: await api.findGalaxyOutfitting({ maxDaysAgo: numeric(values.maxDaysAgo), maxDistance: numeric(values.maxDistance), minimumPadSize: pad(values.pad), module: scalar(values.module), systemName: scalar(values.origin) }) }
    case 'station-lookup': return { id, value: await api.findGalaxyStations({ maxDistance: numeric(values.radius), minimumPadSize: pad(values.pad), name: scalar(values.name), stationType: stationType(values.stationType), systemName: scalar(values.origin) }) }
    case 'faction-presence': return { id, value: await api.findGalaxyFactionPresences({ allegiance: selection(values.allegiance), controlling: controlling(values.controlling), factionName: scalar(values.faction), government: selection(values.government), maxDistance: numeric(values.maxDistance), minInfluence: numeric(values.minInfluence), state: selection(values.state), systemName: scalar(values.origin) }) }
    case 'trade-opportunities': return { id, value: await api.findGalaxyTradeOpportunities({ availableCredits: numeric(values.availableCredits) ?? 0, cargoCapacity: numeric(values.cargoCapacity) ?? 0, maxDaysAgo: numeric(values.maxDaysAgo), maxDistance: numeric(values.maxDistance), minVolume: numeric(values.minVolume), systemName: scalar(values.origin) }) }
    case 'exploration-targets': return { id, value: await api.findGalaxyExplorationTargets({ atmospheres: multiple(values.atmosphere), bodySubtypes: multiple(values.bodyType), landable: landable(values.landable), lastReportedBefore: text(values.lastReportedBefore), maxDistance: numeric(values.maxDistance), maxGravityG: decimal(values.maxGravityG), maxTemperatureK: decimal(values.maxTemperatureK), minBiologicalSignals: numeric(values.minBiologicalSignals), minGeologicalSignals: numeric(values.minGeologicalSignals), minGravityG: decimal(values.minGravityG), minTemperatureK: decimal(values.minTemperatureK), systemName: scalar(values.origin), volcanismTypes: multiple(values.volcanism) }) }
  }
}

function resultStatus(result: GalaxyQueryResult): string { return `${result.value.cache} · ${galaxyQueryResultCount(result)} results` }
function scalar(value?: GalaxyQueryValue): string { return typeof value === 'string' ? value : '' }
function multiple(value?: GalaxyQueryValue): string[] { return Array.isArray(value) ? value : [] }
function numeric(value?: GalaxyQueryValue): number | undefined { const candidate = scalar(value); return candidate.trim() ? Number.parseInt(candidate, 10) : undefined }
function decimal(value?: GalaxyQueryValue): number | undefined { const candidate = scalar(value); return candidate.trim() ? Number(candidate) : undefined }
function text(value?: GalaxyQueryValue): string | undefined { return scalar(value).trim() || undefined }
function selection(value?: GalaxyQueryValue): string | undefined { const candidate = scalar(value); return candidate && candidate !== 'any' ? candidate : undefined }
function pad(value?: GalaxyQueryValue): 'large' | 'medium' | 'small' | undefined { const candidate = scalar(value); return candidate === 'large' || candidate === 'medium' || candidate === 'small' ? candidate : undefined }
function stationType(value?: GalaxyQueryValue): 'any' | 'carrier' | 'orbital' | 'surface' | undefined { const candidate = scalar(value); return candidate === 'carrier' || candidate === 'orbital' || candidate === 'surface' ? candidate : 'any' }
function controlling(value?: GalaxyQueryValue): 'any' | 'yes' | 'no' { const candidate = scalar(value); return candidate === 'yes' || candidate === 'no' ? candidate : 'any' }
function population(value?: GalaxyQueryValue): 'any' | 'inhabited' | 'uninhabited' { const candidate = scalar(value); return candidate === 'inhabited' || candidate === 'uninhabited' ? candidate : 'any' }
function landable(value?: GalaxyQueryValue): 'any' | 'yes' | 'no' { const candidate = scalar(value); return candidate === 'yes' || candidate === 'no' ? candidate : 'any' }

function GalaxyState({ error, title }: { error?: string, title: string }) {
  return (
    <PageFrame layout="fit">
      <PageHeader
        variant="cockpit"
        context={<Breadcrumbs items={[{ label: 'Galaxy', href: '#/galaxy/system' }, { label: title }]} />}
        title={title}
      />
      <Status tone={error ? 'danger' : 'muted'}>{error ?? `Loading ${title.toLocaleLowerCase()}…`}</Status>
    </PageFrame>
  )
}
