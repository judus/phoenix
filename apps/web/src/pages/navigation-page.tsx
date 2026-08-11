import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  CartographicBody,
  CartographicStation,
  CartographyLookupResponse,
  HealthResponse,
  NavigationRoute,
  RuntimeState
} from '@phoenix/contracts'
import type { PhoenixApi } from '../api/phoenix-api-client.js'
import { Page, PageContent, PageFooter, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'

export type NavigationView = 'system' | 'route'

const navigation: NavigationItem[] = [
  { href: '#/navigation/system', icon: '◉', id: 'system', label: 'System map data' },
  { href: '#/navigation/route', icon: '⌁', id: 'route', label: 'Plotted route' }
]

export interface NavigationPageProps {
  api: PhoenixApi
  error?: string
  health?: HealthResponse
  runtimeState?: RuntimeState
  selectedName?: string
  systemName?: string
  view: NavigationView
}

export function NavigationPage ({
  api,
  error,
  health,
  runtimeState,
  selectedName,
  systemName,
  view
}: NavigationPageProps) {
  const [lookup, setLookup] = useState<CartographyLookupResponse>()
  const [route, setRoute] = useState<NavigationRoute>()
  const [query, setQuery] = useState(systemName ?? runtimeState?.system.name ?? '')
  const [loading, setLoading] = useState(true)
  const [navigationError, setNavigationError] = useState<string>()

  useEffect(() => {
    if (view !== 'system') return
    setQuery(systemName ?? runtimeState?.system.name ?? '')
  }, [runtimeState?.system.name, systemName, view])

  useEffect(() => {
    let active = true
    setLoading(true)
    setNavigationError(undefined)
    const request = view === 'route'
      ? api.getNavigationRoute().then(result => { if (active) setRoute(result) })
      : api.getSystemCartography(systemName).then(result => { if (active) setLookup(result) })
    void request.catch(cause => {
      if (active) setNavigationError(cause instanceof Error ? cause.message : 'Navigation data unavailable.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [api, systemName, view])

  const selected = useMemo(() => selectedName && lookup
    ? findSelectedObject(lookup, selectedName)
    : null, [lookup, selectedName])
  const payload = view === 'route'
    ? route
    : lookup && selectedName
      ? { selectedName, selected: selected ?? null, ...lookup }
      : lookup

  const submit = (event: FormEvent): void => {
    event.preventDefault()
    const name = query.trim()
    if (!name) return
    window.location.hash = `/navigation/system?name=${encodeURIComponent(name)}`
  }

  return (
    <PhoenixShell
      activePrimaryItemId="navigation"
      activeSecondaryItemId={view}
      error={error ?? navigationError}
      health={health}
      secondaryNavigation={navigation}
    >
      <Page className="navigation-data-page">
        <PageHeader
          title={view === 'route' ? 'Plotted Route' : lookup?.system.name ?? systemName ?? 'Current System'}
          eyebrow="Navigation data"
          description={view === 'route'
            ? 'Live NavRoute data received from Elite Dangerous.'
            : 'Lossless cartography aggregate from provider data and local observations.'}
        />
        <PageContent>
          {view === 'system' && (
            <form className="navigation-data-toolbar" onSubmit={submit}>
              <label>
                <span>System name</span>
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Current system"
                />
              </label>
              <button type="submit">Load system</button>
              <dl>
                <div><dt>Cache</dt><dd>{lookup?.cache ?? '—'}</dd></div>
                <div><dt>Selected</dt><dd>{selectedName ?? 'None'}</dd></div>
              </dl>
            </form>
          )}
          <section className="navigation-data-inspector" aria-label="Raw navigation data">
            <header>
              <div>
                <span>Raw data</span>
                <h2>{view === 'route' ? 'NavRoute.json' : selectedName ? `System · ${selectedName}` : 'System aggregate'}</h2>
              </div>
              {lookup && <span>{lookup.system.bodies.length} bodies · {lookup.system.stations.length} stations</span>}
              {route && <span>{route.route.length} hops</span>}
            </header>
            {loading
              ? <p className="navigation-data-empty">Loading navigation data…</p>
              : navigationError
                ? <p className="navigation-data-empty">{navigationError}</p>
                : <pre>{JSON.stringify(payload ?? null, null, 2)}</pre>}
          </section>
        </PageContent>
        <PageFooter>
          <span>{view === 'route' ? 'Route telemetry' : 'System cartography'}</span>
          <span>{selectedName && !selected ? `Selection not found: ${selectedName}` : 'Raw view · presentation deferred'}</span>
        </PageFooter>
      </Page>
    </PhoenixShell>
  )
}

function findSelectedObject (
  lookup: CartographyLookupResponse,
  selectedName: string
): CartographicBody | CartographicStation | undefined {
  const normalized = selectedName.toLocaleLowerCase()
  return [...lookup.system.bodies, ...lookup.system.stations]
    .find(candidate => candidate.name.toLocaleLowerCase() === normalized)
}
