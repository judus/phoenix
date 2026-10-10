import { atlasRegionRows, atlasRegions } from './atlas-region-data.js'
import type { AtlasPoi, CommunityGoal, GalnetInvestigationLead, GalaxyBookmarkTarget, NavigationRoute } from '@phoenix/contracts'

export type GalacticPosition = readonly [number, number, number]
export interface AtlasPoint { x: number, y: number }
export interface AtlasMarker {
  id: string
  label: string
  systemName: string
  position: GalacticPosition
  kind: 'landmark' | 'nebula' | 'bookmark' | 'commander' | 'community-goal' | 'investigation' | 'system' | 'route'
  routeStop?: { index: number, destination: boolean, completed: boolean, current: boolean, starClass: string | null }
  selectedName?: string
  bookmarkTarget?: GalaxyBookmarkTarget
  poi?: AtlasPoi
  communityGoal?: CommunityGoal
  investigation?: GalnetInvestigationLead
}
export interface AtlasCamera { x: number, y: number, zoom: number }
export interface AtlasView { azimuth: number, tilt: number }
export const TOP_DOWN_VIEW: AtlasView = { azimuth: 0, tilt: 0 }
export const TILTED_VIEW: AtlasView = { azimuth: -Math.PI / 12, tilt: Math.PI / 3.6 }
export const WHOLE_GALAXY: AtlasCamera = { x: 1024, y: 1024, zoom: 1 }
export const MAX_ATLAS_ZOOM = 2048
export const LY_PER_MAP_UNIT = 4096 / 83

/** Keep the original sequence: missing coordinates break a leg rather than skipping a stop. */
export function atlasNavigationRoute(route: NavigationRoute | undefined, systemName: string | null) {
  const hops = route?.route ?? []
  const currentIndex = systemName === null ? -1 : hops.findIndex(hop => hop.system.trim().toLowerCase() === systemName.trim().toLowerCase())
  const markers: AtlasMarker[] = hops.flatMap((hop, index) => hop.position ? [{
    id: `route:${index}:${hop.address ?? hop.system}`, kind: 'route' as const, label: hop.system, systemName: hop.system, position: hop.position,
    routeStop: { index, destination: index === hops.length - 1, completed: index < currentIndex,
      current: index === currentIndex, starClass: hop.starClass }
  }] : [])
  const legs = hops.flatMap((hop, index) => {
    const previous = hops[index - 1]
    return previous?.position && hop.position
      ? [{ index, from: previous.position, to: hop.position, completed: index <= currentIndex }]
      : []
  })
  return { markers, legs, currentIndex, missingCoordinates: hops.filter(hop => !hop.position).length }
}

/** Use explicit entity identities only; a POI/site label is not a station or body name. */
export function atlasNoteTarget(marker: AtlasMarker): GalaxyBookmarkTarget {
  if (marker.bookmarkTarget) return marker.bookmarkTarget
  if (marker.communityGoal) return { kind: 'station', systemName: marker.systemName, stationName: marker.communityGoal.stationName }
  if (marker.poi?.bodyName && marker.selectedName) return { kind: 'body', systemName: marker.systemName, bodyName: marker.selectedName }
  return { kind: 'system', systemName: marker.systemName }
}

export function atlasPoiMarkers(pois: AtlasPoi[]): AtlasMarker[] {
  return pois.map(poi => ({
    id: poi.id, label: poi.label, systemName: poi.systemName, position: poi.position,
    kind: poi.categories.includes('Nebulae') ? 'nebula' : 'landmark', poi,
    ...(poi.bodyName ? { selectedName: poi.bodyName.startsWith(`${poi.systemName} `) ? poi.bodyName : `${poi.systemName} ${poi.bodyName}` } : {})
  }))
}

export function filterAtlasPois(markers: AtlasMarker[], search: string, category: string): AtlasMarker[] {
  const query = search.trim().toLowerCase()
  return markers.filter(marker => (!category || marker.poi?.categories.includes(category)) &&
    (!query || [marker.label, marker.systemName, marker.poi?.bodyName, marker.poi?.siteType, ...marker.poi?.categories ?? []]
      .some(value => value?.toLowerCase().includes(query))))
}

// Same origin and 49.3494 ly grid as the source lookup. SVG is top-down; Elite Y is height.
export function projectGalacticPosition(position: GalacticPosition): AtlasPoint {
  return { x: (position[0] + 49985) / LY_PER_MAP_UNIT, y: 2048 - (position[2] + 24105) / LY_PER_MAP_UNIT }
}

export function galacticRegion(position: GalacticPosition) {
  const point = projectGalacticPosition(position)
  const px = Math.floor(point.x), pz = Math.floor((position[2] + 24105) / LY_PER_MAP_UNIT)
  if (px < 0 || px >= 2048 || pz < 0 || pz >= atlasRegionRows.length) return undefined
  let end = 0
  for (const [length, id] of atlasRegionRows[pz]) {
    end += length
    if (px < end) return atlasRegions.find(region => region.id === id)
  }
  return undefined
}

export function distanceLy(a: GalacticPosition, b: GalacticPosition): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

export function atlasScale(width: number, height: number, zoom: number): number {
  return Math.max(1, Math.min(width, height) - 32) / 2048 * zoom
}

/** Orthographic projection: Elite Y is real height, not an exaggerated display offset. */
export function screenPoint(point: AtlasPoint, camera: AtlasCamera, width: number, height: number, view = TOP_DOWN_VIEW, heightLy = 0): AtlasPoint {
  const scale = atlasScale(width, height, camera.zoom)
  const dx = point.x - camera.x, dy = point.y - camera.y
  const u = dx * Math.cos(view.azimuth) - dy * Math.sin(view.azimuth)
  const v = dx * Math.sin(view.azimuth) + dy * Math.cos(view.azimuth)
  return { x: width / 2 + u * scale,
    y: height / 2 + (v * Math.cos(view.tilt) - heightLy / LY_PER_MAP_UNIT * Math.sin(view.tilt)) * scale }
}

function planeOffset(x: number, y: number, view: AtlasView): AtlasPoint {
  const v = y / Math.cos(view.tilt)
  return { x: x * Math.cos(view.azimuth) + v * Math.sin(view.azimuth),
    y: -x * Math.sin(view.azimuth) + v * Math.cos(view.azimuth) }
}

export function panAtlas(camera: AtlasCamera, delta: AtlasPoint, width: number, height: number, view = TOP_DOWN_VIEW): AtlasCamera {
  const scale = atlasScale(width, height, camera.zoom)
  const offset = planeOffset(delta.x / scale, delta.y / scale, view)
  return { ...camera, x: camera.x - offset.x, y: camera.y - offset.y }
}

export function orbitAtlas(view: AtlasView, delta: AtlasPoint): AtlasView {
  return { azimuth: (view.azimuth + delta.x * 0.006) % (2 * Math.PI),
    tilt: Math.max(Math.PI / 18, Math.min(Math.PI * 7 / 18, view.tilt + delta.y * 0.006)) }
}

export function focusAtlas(position: GalacticPosition, zoom: number, view = TOP_DOWN_VIEW): AtlasCamera {
  const plane = projectGalacticPosition(position)
  const offset = position[1] / LY_PER_MAP_UNIT * Math.tan(view.tilt)
  return { zoom, x: plane.x - offset * Math.sin(view.azimuth), y: plane.y - offset * Math.cos(view.azimuth) }
}

/** The galactic plane is affine under orthographic projection; reuse its existing SVG paths. */
export function atlasPlaneTransform(camera: AtlasCamera, width: number, height: number, view = TOP_DOWN_VIEW): string {
  const scale = atlasScale(width, height, camera.zoom)
  const a = scale * Math.cos(view.azimuth), b = scale * Math.sin(view.azimuth) * Math.cos(view.tilt)
  const c = -scale * Math.sin(view.azimuth), d = scale * Math.cos(view.azimuth) * Math.cos(view.tilt)
  return `matrix(${a} ${b} ${c} ${d} ${width / 2 - a * camera.x - c * camera.y} ${height / 2 - b * camera.x - d * camera.y})`
}

export function zoomAtlas(camera: AtlasCamera, factor: number, anchor: AtlasPoint, width: number, height: number, view = TOP_DOWN_VIEW): AtlasCamera {
  const zoom = Math.max(1, Math.min(MAX_ATLAS_ZOOM, camera.zoom * factor))
  const before = atlasScale(width, height, camera.zoom), after = atlasScale(width, height, zoom)
  const offset = planeOffset((anchor.x - width / 2) * (1 / before - 1 / after), (anchor.y - height / 2) * (1 / before - 1 / after), view)
  return { zoom, x: camera.x + offset.x, y: camera.y + offset.y }
}

export function clusterAtlasMarkers(markers: AtlasMarker[], camera: AtlasCamera, width: number, height: number, view = TOP_DOWN_VIEW) {
  const clusters: { point: AtlasPoint, ground: AtlasPoint, depth: number, markers: AtlasMarker[] }[] = []
  for (const marker of markers) {
    const plane = projectGalacticPosition(marker.position)
    const ground = screenPoint(plane, camera, width, height, view)
    const point = screenPoint(plane, camera, width, height, view, marker.position[1])
    if (point.x < -24 || point.y < -24 || point.x > width + 24 || point.y > height + 24) continue
    const cluster = clusters.find(cluster => Math.hypot(cluster.point.x - point.x, cluster.point.y - point.y) < 30)
    if (cluster) cluster.markers.push(marker)
    else {
      const v = (plane.x - camera.x) * Math.sin(view.azimuth) + (plane.y - camera.y) * Math.cos(view.azimuth)
      clusters.push({ point, ground, depth: v * Math.sin(view.tilt) + marker.position[1] / LY_PER_MAP_UNIT * Math.cos(view.tilt), markers: [marker] })
    }
  }
  return view.tilt ? clusters.sort((a, b) => a.depth - b.depth) : clusters
}

// Coordinates verified against EDSM api-v1/systems, 2026-10-03.
// Nebula markers identify a named reference system, not an invented nebula boundary/centre.
export const ATLAS_LANDMARKS: AtlasMarker[] = [
  { id: 'sol', label: 'Sol / The Bubble', systemName: 'Sol', position: [0, 0, 0], kind: 'landmark' },
  { id: 'colonia', label: 'Colonia', systemName: 'Colonia', position: [-9530.5, -910.28125, 19808.125], kind: 'landmark' },
  { id: 'sagittarius', label: 'Sagittarius A*', systemName: 'Sagittarius A*', position: [25.21875, -20.90625, 25899.96875], kind: 'landmark' },
  { id: 'beagle', label: 'Beagle Point', systemName: 'Beagle Point', position: [-1111.5625, -134.21875, 65269.75], kind: 'landmark' },
  { id: 'pleiades', label: 'Pleiades · Maia', systemName: 'Maia', position: [-81.78125, -149.4375, -343.375], kind: 'nebula' },
  { id: 'orion', label: 'Orion Nebula', systemName: 'PMD2009 48', position: [594.90625, -431.4375, -1071.78125], kind: 'nebula' },
  { id: 'california', label: 'California Nebula', systemName: 'California Sector BA-A e6', position: [-319.8125, -216.75, -913.46875], kind: 'nebula' },
  { id: 'eagle', label: 'Eagle Nebula', systemName: 'Eagle Sector IR-W d1-117', position: [-2054.09375, 85.71875, 6710.875], kind: 'nebula' }
]
