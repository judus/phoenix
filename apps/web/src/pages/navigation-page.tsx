import { useEffect, useMemo, useState } from 'react'
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
import { SystemSchematic } from '../features/navigation/system-schematic.js'

export type NavigationView = 'system' | 'route'

const navigation: NavigationItem[] = [
  { href: '#/navigation/system', icon: '◉', id: 'system', label: 'System map' },
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
  const loadSystem = (): void => {
    const name = query.trim()
    if (!name) return
    window.location.hash = `/navigation/system?name=${encodeURIComponent(name)}`
  }

  const selectObject = (name?: string): void => {
    const parameters = new URLSearchParams({ name: lookup?.system.name ?? systemName ?? query })
    if (name) parameters.set('selected', name)
    window.location.hash = `/navigation/system?${parameters.toString()}`
  }

  return (
    <PhoenixShell
      activePrimaryItemId="navigation"
      activeSecondaryItemId={view}
      error={error ?? navigationError}
      health={health}
      secondaryNavigation={navigation}
    >
      {view === 'system'
        ? (
            <Page className="navigation-data-page navigation-system-page">
              <PageContent>
                {loading
                  ? <p className="navigation-data-empty">Loading navigation data…</p>
                  : navigationError
                    ? <p className="navigation-data-empty">{navigationError}</p>
                    : lookup && (
                      <SystemSchematic
                        onQueryChange={setQuery}
                        onSearch={loadSystem}
                        onSelect={selectObject}
                        query={query}
                        selected={selected}
                        system={lookup.system}
                      />
                    )}
              </PageContent>
            </Page>
          )
        : (
            <Page className="navigation-data-page">
              <PageHeader
                title="Plotted Route"
                eyebrow="Navigation data"
                description="Live NavRoute data received from Elite Dangerous."
              />
              <PageContent>
                {loading
                  ? <p className="navigation-data-empty">Loading navigation data…</p>
                  : navigationError
                    ? <p className="navigation-data-empty">{navigationError}</p>
                    : (
                        <section className="navigation-data-inspector" aria-label="Raw navigation data">
                          <header><div><span>Route telemetry</span><h2>NavRoute.json</h2></div>{route && <span>{route.route.length} hops</span>}</header>
                          <pre>{JSON.stringify(route ?? null, null, 2)}</pre>
                        </section>
                      )}
              </PageContent>
              <PageFooter><span>Route telemetry</span><span>Raw route telemetry</span></PageFooter>
            </Page>
          )}
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
