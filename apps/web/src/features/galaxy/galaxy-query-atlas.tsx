import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Loading } from '@phoenix/ui'
import type { NavigationRoute } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { GalacticAtlasWorkspace } from './galactic-atlas-page.js'
import { ATLAS_LANDMARKS, MAX_ATLAS_ZOOM, WHOLE_GALAXY, projectGalacticPosition, type AtlasCamera, type AtlasMarker, type GalacticPosition } from './galactic-atlas-model.js'
import { galaxyQueryLocations, type GalaxyQueryResult } from './galaxy-query-results.js'

export function GalaxyQueryAtlas({ api, result, position, systemName, navigationRoute, onNavigate, renderLayout }: {
  renderLayout?: (controls: ReactNode, instrument: ReactNode) => ReactNode
  api: PhoenixApi
  result: GalaxyQueryResult
  position: GalacticPosition | null
  systemName: string | null
  navigationRoute?: NavigationRoute
  onNavigate(route: PhoenixRoute): void
}) {
  const locations = useMemo(() => galaxyQueryLocations(result), [result])
  const [resolved, setResolved] = useState({ locations, markers: [] as AtlasMarker[], pending: locations.length, unavailable: 0, failures: 0 })
  useEffect(() => {
    const controller = new AbortController()
    const positions = new Map<string, GalacticPosition>()
    for (const marker of ATLAS_LANDMARKS) positions.set(key(marker.systemName), marker.position)
    for (const hop of navigationRoute?.route ?? []) if (hop.position) positions.set(key(hop.system), hop.position)
    if (position && systemName) positions.set(key(systemName), position)
    for (const { marker } of locations) if (marker.position) positions.set(key(marker.systemName), marker.position)
    const systems = new Map(locations.map(({ marker }) => [key(marker.systemName), marker.systemName]))
    const queue = [...systems].filter(([name]) => !positions.has(name))
    const state = { locations, pending: queue.length, unavailable: 0, failures: 0 }
    const publish = () => {
      if (controller.signal.aborted) return
      const markers = locations.flatMap(({ marker }) => {
        const coordinates = marker.position ?? positions.get(key(marker.systemName))
        return coordinates ? [{ ...marker, position: coordinates }] : []
      })
      setResolved({ ...state, markers })
    }
    publish()
    const worker = async () => {
      while (queue.length && !controller.signal.aborted) {
        const [name, system] = queue.shift()!
        try {
          const coordinates = (await api.getSystemCartography(system, controller.signal)).system.position
          if (coordinates) positions.set(name, coordinates)
          else state.unavailable++
        } catch {
          state.failures++
        }
        state.pending--
        publish()
      }
    }
    void Promise.all([worker(), worker()])
    return () => controller.abort()
    // Route updates are rendered live, but do not restart completed coordinate lookups.
  }, [api, locations])

  const initialCamera = useMemo(() => resolved.pending
    ? position ? { ...projectGalacticPosition(position), zoom: 4 } : WHOLE_GALAXY
    : queryAtlasCamera(resolved.markers.map(marker => marker.position), position), [resolved.markers, resolved.pending, position])
  if (resolved.locations !== locations) {
    const loading = <Loading>Locating query results…</Loading>
    return renderLayout ? renderLayout(null, loading) : <div className="query-result-atlas">{loading}</div>
  }
  return <GalacticAtlasWorkspace api={api} renderLayout={renderLayout}
    onNavigate={onNavigate} position={position} systemName={systemName} navigationRoute={navigationRoute}
    results={{ markers: resolved.markers, initialCamera, fitReady: resolved.pending === 0,
      status: locations.length === 0 ? 'No matching results.' : [
        `${resolved.markers.length} / ${locations.length} result locations`,
        resolved.pending ? `Locating ${resolved.pending} system${resolved.pending === 1 ? '' : 's'}…` : '',
        resolved.unavailable ? `${resolved.unavailable} system${resolved.unavailable === 1 ? '' : 's'} without coordinates — see Table` : '',
        resolved.failures ? `${resolved.failures} coordinate lookup${resolved.failures === 1 ? '' : 's'} failed — see Table` : ''
      ].filter(Boolean).join(' · '),
      detail: marker => locations.find(location => location.marker.id === marker.id)?.detail
    }} />
}

function key(system: string): string { return system.trim().toLowerCase() }

/** Fit the query area, not the entire plotted route (which may span the galaxy). */
export function queryAtlasCamera(positions: readonly GalacticPosition[], current: GalacticPosition | null): AtlasCamera {
  const points = [...positions, ...(current ? [current] : [])].map(projectGalacticPosition)
  if (!points.length) return WHOLE_GALAXY
  const xs = points.map(point => point.x), ys = points.map(point => point.y)
  const width = Math.max(...xs) - Math.min(...xs), height = Math.max(...ys) - Math.min(...ys)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2,
    zoom: Math.max(1, Math.min(MAX_ATLAS_ZOOM, 2048 / Math.max(1, width, height) * 0.65)) }
}
