import type { NavigationRoute, NavigationRouteHop, RuntimeState } from '@phoenix/contracts'

export interface PlottedRouteProps {
  route: NavigationRoute
  runtimeState?: RuntimeState
}

interface RouteLeg {
  cumulativeDistance: number | null
  distance: number | null
  hop: NavigationRouteHop
  index: number
}

export function PlottedRoute ({ route, runtimeState }: PlottedRouteProps) {
  const legs = buildRouteLegs(route)
  const currentIndex = findCurrentHopIndex(route, runtimeState?.system.name)
  const progressKnown = currentIndex >= 0
  const nextIndex = progressKnown ? currentIndex + 1 : route.route.length > 0 ? 0 : -1
  const nextHop = route.route[nextIndex]
  const totalDistance = legs.at(-1)?.cumulativeDistance ?? null
  const completedDistance = progressKnown ? legs[currentIndex]?.cumulativeDistance ?? null : null
  const remainingDistance = totalDistance !== null && completedDistance !== null
    ? Math.max(0, totalDistance - completedDistance)
    : null
  const remainingJumps = progressKnown
    ? Math.max(0, route.route.length - currentIndex - 1)
    : Math.max(0, route.route.length - 1)

  if (route.route.length === 0) {
    return (
      <section className="plotted-route plotted-route--empty">
        <p>No route plotted.</p>
        <small>Plot a route in Elite to load its jump sequence here.</small>
      </section>
    )
  }

  const origin = route.route[0]!
  const destination = route.route.at(-1)!

  return (
    <section className="plotted-route" aria-label="Plotted navigation route">
      <header className="plotted-route__summary">
        <div className="plotted-route__endpoints">
          <span>Route</span>
          <a href={systemHref(origin.system)}>{origin.system}</a>
          <i aria-hidden="true" />
          <a href={systemHref(destination.system)}>{destination.system}</a>
        </div>
        <dl>
          <div><dt>Jumps</dt><dd>{Math.max(0, route.route.length - 1)}</dd></div>
          <div><dt>Distance</dt><dd>{formatDistance(totalDistance)}</dd></div>
          <div><dt>Remaining</dt><dd>{progressKnown ? remainingJumps : '—'}</dd></div>
          <div><dt>Route plotted</dt><dd>{formatTimestamp(route.timestamp)}</dd></div>
        </dl>
      </header>

      <div className="plotted-route__body">
        <aside className="plotted-route__next">
          <span>{progressKnown ? 'Next jump' : 'Route origin'}</span>
          {nextHop
            ? (
                <>
                  <a href={systemHref(nextHop.system)}>{nextHop.system}</a>
                  <dl>
                    <div><dt>Star class</dt><dd>{nextHop.starClass ?? '—'}</dd></div>
                    <div><dt>Leg distance</dt><dd>{formatDistance(legs[nextIndex]?.distance ?? null)}</dd></div>
                    <div><dt>Distance remaining</dt><dd>{formatDistance(remainingDistance)}</dd></div>
                  </dl>
                </>
              )
            : <strong>Destination reached</strong>}
          {!progressKnown && runtimeState?.system.name && (
            <small>Current system is not present in this route; progress is unknown.</small>
          )}
        </aside>

        <div className="plotted-route__hops">
          <table className="data-table plotted-route__table">
            <thead>
              <tr>
                <th scope="col">Jump</th>
                <th scope="col">System</th>
                <th scope="col">Star</th>
                <th scope="col" className="align-right">Leg</th>
                <th scope="col" className="align-right">Route distance</th>
              </tr>
            </thead>
            <tbody>
              {legs.map(leg => {
                const state = progressKnown
                  ? leg.index < currentIndex
                    ? 'is-complete'
                    : leg.index === currentIndex
                      ? 'is-current'
                      : 'is-upcoming'
                  : 'is-upcoming'
                return (
                  <tr className={state} key={`${leg.hop.address ?? leg.hop.system}-${leg.index}`}>
                    <td>{leg.index === 0 ? 'Origin' : leg.index}</td>
                    <td><a href={systemHref(leg.hop.system)}>{leg.hop.system}</a></td>
                    <td>{leg.hop.starClass ?? '—'}</td>
                    <td className="align-right">{leg.index === 0 ? '—' : formatDistance(leg.distance)}</td>
                    <td className="align-right">{formatDistance(leg.cumulativeDistance)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export function buildRouteLegs (route: NavigationRoute): RouteLeg[] {
  let cumulativeDistance = 0
  let complete = true
  return route.route.map((hop, index) => {
    const previous = route.route[index - 1]
    const distance = previous ? distanceBetween(previous, hop) : 0
    if (distance === null) complete = false
    if (distance !== null) cumulativeDistance += distance
    return {
      cumulativeDistance: complete ? cumulativeDistance : null,
      distance,
      hop,
      index
    }
  })
}

function findCurrentHopIndex (route: NavigationRoute, systemName?: string | null): number {
  if (!systemName) return -1
  const normalized = systemName.trim().toLocaleLowerCase()
  return route.route.findIndex(hop => hop.system.trim().toLocaleLowerCase() === normalized)
}

function distanceBetween (from: NavigationRouteHop, to: NavigationRouteHop): number | null {
  if (!from.position || !to.position) return null
  return Math.hypot(
    to.position[0] - from.position[0],
    to.position[1] - from.position[1],
    to.position[2] - from.position[2]
  )
}

function formatDistance (distance: number | null): string {
  return distance === null ? '—' : `${distance.toFixed(1)} ly`
}

function formatTimestamp (timestamp: string | null): string {
  if (!timestamp) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(timestamp))
}

function systemHref (systemName: string): string {
  return `#/galaxy/system?name=${encodeURIComponent(systemName)}`
}
