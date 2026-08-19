import type { NavigationRoute, NavigationRouteHop, RuntimeState } from '@phoenix/contracts'
import {
  Breadcrumbs,
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
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'

export interface PlottedRouteProps {
  route: NavigationRoute
  runtimeState?: RuntimeState
}

export interface RouteLeg {
  cumulativeDistance: number | null
  distance: number | null
  hop: NavigationRouteHop
  index: number
}

export function PlottedRoute({ route, runtimeState }: PlottedRouteProps) {
  const legs = buildRouteLegs(route)
  const currentIndex = findCurrentHopIndex(route, runtimeState?.system.name)
  const progressKnown = currentIndex >= 0
  const nextIndex = progressKnown ? currentIndex + 1 : route.route.length > 0 ? 0 : -1
  const nextHop = route.route[nextIndex]
  const totalDistance = legs.at(-1)?.cumulativeDistance ?? null

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
                <DataTableGroup contentGap="sm" title={progressKnown ? 'Next jump' : 'Route origin'}>
                  <Stack gap="lg">
                    {nextHop
                      ? <>
                          <Metric className="text-information" value={<a href={systemHref(nextHop.system)}>{nextHop.system}</a>} />
                          <DescriptionList columns="one" density="compact">
                            <DescriptionItem label="Star class" value={nextHop.starClass ?? '—'} />
                            <DescriptionItem label="Leg distance" value={formatDistance(legs[nextIndex]?.distance ?? null)} />
                          </DescriptionList>
                        </>
                      : <Status tone="muted">Destination reached.</Status>}
                    {!progressKnown && runtimeState?.system.name && (
                      <Status tone="muted">Current system is not present in this route; progress is unknown.</Status>
                    )}
                  </Stack>
                </DataTableGroup>

                <DataTableGroup className="route-sequence" title="Jump sequence">
                  <div className="route-table-scroll" tabIndex={0}>
                    <DataTable density="compact" label="Plotted route jump sequence" narrow="priority" scheme="surface" stickyHeader>
                      <thead><tr><th>Jump</th><th>System</th><th>Star</th><th className="numeric">Leg</th><th className="numeric">Route distance</th></tr></thead>
                      <tbody>
                        {legs.map(leg => {
                          return (
                            <tr className={progressKnown && leg.index === currentIndex ? 'active' : undefined} key={`${leg.hop.address ?? leg.hop.system}-${leg.index}`}>
                              <td>{leg.index === 0 ? 'Origin' : leg.index}</td>
                              <td><a href={systemHref(leg.hop.system)}>{leg.hop.system}</a></td>
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

function systemHref(systemName: string): string {
  return phoenixRouteHash({ kind: 'information', section: 'galaxy', view: 'system', systemName })
}
