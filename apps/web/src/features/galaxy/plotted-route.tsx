import { useEffect, useMemo, useState } from 'react'
import type { CartographyLookupResponse, GameActionCatalogResponse, NavigationRoute, NavigationRouteHop, RuntimeState } from '@phoenix/contracts'
import {
  Breadcrumbs,
  CommandTile,
  DataTable,
  DataTableGroup,
  DescriptionItem,
  DescriptionList,
  Inline,
  Metric,
  PageFrame,
  PageHeader,
  Stack,
  Status
} from '@phoenix/ui'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import { LatestRequest } from '../../application/requests/latest-request.js'
import { SystemSchematicLink } from '../../components/system-location-link.js'

export interface PlottedRouteProps {
  actions?: GameActionCatalogResponse
  api: Pick<PhoenixApi, 'executeAction' | 'getSystemCartography'>
  route: NavigationRoute
  runtimeState?: RuntimeState
}

export interface RouteLeg {
  cumulativeDistance: number | null
  distance: number | null
  hop: NavigationRouteHop
  index: number
}

type PreviewState =
  | { status: 'idle' | 'loading' }
  | { error: string, status: 'error' }
  | { lookup: CartographyLookupResponse, status: 'ready' }

type ActionState = { message: string, tone: 'positive' | 'warning' | 'danger' } | undefined

export function PlottedRoute({ actions, api, route, runtimeState }: PlottedRouteProps) {
  const legs = buildRouteLegs(route)
  const currentIndex = findCurrentHopIndex(route, runtimeState?.system.name)
  const progressKnown = currentIndex >= 0
  const nextIndex = progressKnown ? currentIndex + 1 : route.route.length > 0 ? 0 : -1
  const nextHop = route.route[nextIndex]
  const targetNextRouteAction = actions?.actions.find(action => action.definition.id === 'elite.TargetNextRouteSystem')
  const totalDistance = legs.at(-1)?.cumulativeDistance ?? null
  const defaultPreviewIndex = nextHop ? nextIndex : -1
  const routeIdentity = useMemo(
    () => `${route.timestamp ?? ''}:${route.route.map(hop => `${hop.address ?? ''}:${hop.system}`).join('|')}`,
    [route]
  )
  const [requestedPreviewIndex, setRequestedPreviewIndex] = useState(defaultPreviewIndex)
  const previewIndex = canPreview(requestedPreviewIndex, currentIndex, progressKnown, route.route.length)
    ? requestedPreviewIndex
    : defaultPreviewIndex
  const previewHop = route.route[previewIndex]
  const [preview, setPreview] = useState<PreviewState>({ status: previewHop ? 'loading' : 'idle' })
  const [targeting, setTargeting] = useState(false)
  const [actionState, setActionState] = useState<ActionState>()

  useEffect(() => setRequestedPreviewIndex(defaultPreviewIndex), [defaultPreviewIndex, routeIdentity])

  useEffect(() => {
    if (!previewHop) {
      setPreview({ status: 'idle' })
      return
    }
    const latest = new LatestRequest()
    const signal = latest.start()
    setPreview({ status: 'loading' })
    void api.getSystemCartography(previewHop.system, signal).then(lookup => {
      if (latest.isCurrent(signal)) setPreview({ lookup, status: 'ready' })
    }).catch(cause => {
      if (!latest.isCurrent(signal)) return
      setPreview({
        error: cause instanceof Error ? cause.message : 'System cartography unavailable.',
        status: 'error'
      })
    })
    return () => latest.cancel()
  }, [api, previewHop])

  const targetNextJump = async () => {
    setTargeting(true)
    setActionState(undefined)
    try {
      const result = await api.executeAction('elite.TargetNextRouteSystem', 'tap')
      setActionState({
        message: result.message,
        tone: result.status === 'accepted' ? 'positive' : result.status === 'rejected' ? 'warning' : 'danger'
      })
    } catch (cause) {
      setActionState({
        message: cause instanceof Error ? cause.message : 'Unable to send the next-route-system command.',
        tone: 'danger'
      })
    } finally {
      setTargeting(false)
    }
  }

  return (
    <PageFrame layout="fit">
      <div className="plotted-route" aria-label="Plotted navigation route">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Galaxy' }, { label: 'Plotted route' }]} />}
          status={route.timestamp ? `Route plotted ${formatTimestamp(route.timestamp)}` : 'Route timestamp unknown'}
          title="Plotted route"
        />

        {route.route.length === 0
          ? <Status tone="muted">No route plotted. Plot a route in Elite to load its jump sequence here.</Status>
          : <>
              <section className="route-overview" aria-label="Route summary">
                <div className="route-path">
                  <Metric density="compact" label="Origin" value={route.route[0]!.system.toLocaleUpperCase()} />
                  <i aria-hidden="true" />
                  <Metric density="compact" label="Destination" value={route.route.at(-1)!.system.toLocaleUpperCase()} />
                </div>
                <Inline className="route-facts" gap="xl" wrap={false}>
                  <Metric className="text-end" density="compact" label="Jumps" value={String(Math.max(0, route.route.length - 1))} />
                  <Metric className="text-end" density="compact" label="Distance" value={formatDistance(totalDistance)} />
                </Inline>
              </section>

              <div className="route-body">
                <DataTableGroup
                  className="route-preview"
                  contentGap="sm"
                  fill
                  meta={preview.status === 'ready' ? `${preview.lookup.cache} · ${preview.lookup.system.source.provider.toUpperCase()}` : undefined}
                  title={previewTitle(previewIndex, currentIndex, progressKnown)}
                >
                  <Stack fill gap="lg">
                    {previewHop
                      ? <>
                          <Metric
                            className="text-information"
                            value={<SystemSchematicLink label={previewHop.system} systemName={previewHop.system} />}
                          />
                          <DescriptionList columns="one" density="compact">
                            <DescriptionItem label="Star class" value={previewHop.starClass ?? 'Unknown'} />
                            <DescriptionItem label="Leg distance" value={formatDistance(legs[previewIndex]?.distance ?? null)} />
                            {preview.status === 'ready' && <>
                              <DescriptionItem label="Bodies" value={bodyCount(preview.lookup)} />
                              <DescriptionItem label="Installations" value={`${preview.lookup.system.stations.length} known`} />
                              <DescriptionItem label="Economy" value={preview.lookup.system.information.primaryEconomy ?? 'Unknown'} />
                              <DescriptionItem label="Population" value={population(preview.lookup.system.information.population)} />
                              <DescriptionItem label="Allegiance" value={preview.lookup.system.information.allegiance ?? 'Unknown'} />
                              <DescriptionItem label="Security" value={preview.lookup.system.information.security ?? 'Unknown'} />
                            </>}
                          </DescriptionList>
                          {preview.status === 'loading' && <Status tone="muted">Loading system cartography…</Status>}
                          {preview.status === 'error' && <Status tone="warning" wrap>{preview.error}</Status>}
                        </>
                      : <Status tone="muted">Destination reached.</Status>}
                    {actionState && <Status tone={actionState.tone} wrap>{actionState.message}</Status>}
                    {!progressKnown && runtimeState?.system.name && (
                      <Status tone="muted">Current system is not present in this route; progress is unknown.</Status>
                    )}
                    {nextHop && <CommandTile
                      binding={targetNextRouteAction?.binding?.display}
                      className="route-target-command"
                      compact
                      disabled={targeting || !targetNextRouteAction?.available}
                      label={targeting ? 'Targeting…' : 'Target next jump'}
                      meta="Tap"
                      onClick={targetNextJump}
                      unavailable={targetNextRouteAction !== undefined && !targetNextRouteAction.available}
                    />}
                  </Stack>
                </DataTableGroup>

                <DataTableGroup className="route-sequence" title="Jump sequence">
                  <div className="route-table-scroll" tabIndex={0}>
                    <DataTable density="compact" label="Plotted route jump sequence" narrow="priority" scheme="surface" stickyHeader>
                      <thead><tr><th>Jump</th><th>System</th><th>Star</th><th className="numeric">Leg</th><th className="numeric">Route distance</th></tr></thead>
                      <tbody>
                        {legs.map(leg => {
                          const selectable = canPreview(leg.index, currentIndex, progressKnown, route.route.length)
                          return (
                            <tr
                              aria-selected={leg.index === previewIndex || undefined}
                              className={leg.index === previewIndex ? 'active' : undefined}
                              key={`${leg.hop.address ?? leg.hop.system}-${leg.index}`}
                              onClick={selectable ? () => setRequestedPreviewIndex(leg.index) : undefined}
                              onKeyDown={selectable ? event => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  setRequestedPreviewIndex(leg.index)
                                }
                              } : undefined}
                              tabIndex={selectable ? 0 : undefined}
                            >
                              <td>{leg.index === 0 ? 'Origin' : progressKnown && leg.index === currentIndex ? 'Current' : leg.index}</td>
                              <td>{leg.hop.system}</td>
                              <td>{leg.hop.starClass ?? '—'}</td>
                              <td className="numeric">{leg.index === 0 ? '—' : formatDistance(leg.distance)}</td>
                              <td className="numeric">{formatDistance(leg.cumulativeDistance)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </DataTable>
                  </div>
                </DataTableGroup>
              </div>
            </>}
      </div>
    </PageFrame>
  )
}

function canPreview(index: number, currentIndex: number, progressKnown: boolean, routeLength: number): boolean {
  return index >= 0 && index < routeLength && (!progressKnown || index >= currentIndex)
}

function previewTitle(index: number, currentIndex: number, progressKnown: boolean): string {
  if (index < 0) return 'Route complete'
  if (!progressKnown) return index === 0 ? 'Route origin' : `Jump ${index}`
  const jumpsAhead = index - currentIndex
  if (jumpsAhead === 0) return 'Current system'
  if (jumpsAhead === 1) return 'Next jump'
  return `${jumpsAhead} jumps ahead`
}

function bodyCount(lookup: CartographyLookupResponse): string {
  const { knownBodies, reportedBodies } = lookup.system.scanProgress
  return reportedBodies !== null && reportedBodies !== knownBodies
    ? `${knownBodies} known · ${reportedBodies} reported`
    : `${knownBodies} known`
}

function population(value: number | null): string {
  return value === null ? 'Unknown' : value.toLocaleString()
}

export function buildRouteLegs(route: NavigationRoute): RouteLeg[] {
  let cumulativeDistance = 0
  let complete = true
  return route.route.map((hop, index) => {
    const previous = route.route[index - 1]
    const distance = previous ? distanceBetween(previous, hop) : 0
    if (distance === null) complete = false
    if (distance !== null) cumulativeDistance += distance
    return { cumulativeDistance: complete ? cumulativeDistance : null, distance, hop, index }
  })
}

function findCurrentHopIndex(route: NavigationRoute, systemName?: string | null): number {
  if (!systemName) return -1
  const normalized = systemName.trim().toLocaleLowerCase()
  return route.route.findIndex(hop => hop.system.trim().toLocaleLowerCase() === normalized)
}

function distanceBetween(from: NavigationRouteHop, to: NavigationRouteHop): number | null {
  if (!from.position || !to.position) return null
  return Math.hypot(
    to.position[0] - from.position[0],
    to.position[1] - from.position[1],
    to.position[2] - from.position[2]
  )
}

function formatDistance(distance: number | null): string {
  return distance === null ? '—' : `${distance.toFixed(1)} ly`
}

function formatTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp))
}
