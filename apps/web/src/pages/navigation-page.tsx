import { useEffect, useMemo, useState } from 'react'
import {
  NavigationRouteSchema,
  type CartographicBody,
  type CartographicStation,
  type CartographyLookupResponse,
  type HealthResponse,
  type NavigationRoute,
  type RuntimeState
} from '@phoenix/contracts'
import type { PhoenixApi } from '../api/phoenix-api-client.js'
import { Page, PageContent, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'
import { SystemSchematic } from '../features/navigation/system-schematic.js'
import { PlottedRoute } from '../features/navigation/plotted-route.js'
import { GalaxyDatabase } from '../features/galaxy/galaxy-database.js'
import { subscribePhoenixEvent } from '../api/phoenix-event-stream.js'

export type NavigationView = 'database' | 'system' | 'route'

const navigation: NavigationItem[] = [
  { href: '#/galaxy/system', icon: '◉', id: 'system', label: 'Current system' },
  { href: '#/galaxy/route', icon: '⌁', id: 'route', label: 'Plotted route' },
  { href: '#/galaxy/database', icon: '▤', id: 'database', label: 'Galaxy database' }
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
    if (view === 'database') {
      setLoading(false)
      return
    }
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

  useEffect(() => {
    if (view !== 'route') return
    return subscribePhoenixEvent(api, 'navigation-route', event => {
      const parsed = NavigationRouteSchema.safeParse(JSON.parse(event.data))
      if (parsed.success) setRoute(parsed.data)
    })
  }, [api, view])

  const selected = useMemo(() => selectedName && lookup
    ? findSelectedObject(lookup, selectedName)
    : null, [lookup, selectedName])
  const loadSystem = (): void => {
    const name = query.trim()
    if (!name) return
    window.location.hash = `/galaxy/system?name=${encodeURIComponent(name)}`
  }

  const selectObject = (name?: string): void => {
    const parameters = new URLSearchParams({ name: lookup?.system.name ?? systemName ?? query })
    if (name) parameters.set('selected', name)
    window.location.hash = `/galaxy/system?${parameters.toString()}`
  }

  return (
    <PhoenixShell
      activePrimaryItemId="galaxy"
      activeSecondaryItemId={view}
      error={error ?? navigationError}
      health={health}
      secondaryNavigation={navigation}
    >
      {view === 'database'
        ? (
            <Page className="navigation-data-page galaxy-database-page">
              <PageContent>
                <GalaxyDatabase api={api} currentSystem={runtimeState?.system.name} />
              </PageContent>
            </Page>
          )
        : view === 'system'
        ? (
            <Page className="navigation-data-page navigation-system-page">
              <PageContent variant="bleed">
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
            <Page className="navigation-data-page plotted-route-page">
              <PageHeader
                title="Plotted Route"
                eyebrow="Galaxy · Route"
                description="Current jump sequence and route progress."
              />
              <PageContent>
                {loading
                  ? <p className="navigation-data-empty">Loading navigation data…</p>
                  : navigationError
                    ? <p className="navigation-data-empty">{navigationError}</p>
                    : (
                        route && <PlottedRoute route={route} runtimeState={runtimeState} />
                      )}
              </PageContent>
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
