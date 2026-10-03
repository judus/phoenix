import { atlasRegionRows, atlasRegions } from './atlas-region-data.js'

export type GalacticPosition = readonly [number, number, number]
export interface AtlasPoint { x: number, y: number }
export interface AtlasMarker {
  id: string
  label: string
  systemName: string
  position: GalacticPosition
  kind: 'landmark' | 'nebula' | 'bookmark' | 'commander'
  selectedName?: string
}
export interface AtlasCamera { x: number, y: number, zoom: number }
export const WHOLE_GALAXY: AtlasCamera = { x: 1024, y: 1024, zoom: 1 }
export const LY_PER_MAP_UNIT = 4096 / 83

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

export function screenPoint(point: AtlasPoint, camera: AtlasCamera, width: number, height: number): AtlasPoint {
  const scale = atlasScale(width, height, camera.zoom)
  return { x: width / 2 + (point.x - camera.x) * scale, y: height / 2 + (point.y - camera.y) * scale }
}

export function zoomAtlas(camera: AtlasCamera, factor: number, anchor: AtlasPoint, width: number, height: number): AtlasCamera {
  const zoom = Math.max(1, Math.min(64, camera.zoom * factor))
  const before = atlasScale(width, height, camera.zoom), after = atlasScale(width, height, zoom)
  return { zoom, x: camera.x + (anchor.x - width / 2) * (1 / before - 1 / after), y: camera.y + (anchor.y - height / 2) * (1 / before - 1 / after) }
}

export function clusterAtlasMarkers(markers: AtlasMarker[], camera: AtlasCamera, width: number, height: number) {
  const clusters: { point: AtlasPoint, markers: AtlasMarker[] }[] = []
  for (const marker of markers) {
    const point = screenPoint(projectGalacticPosition(marker.position), camera, width, height)
    if (point.x < -24 || point.y < -24 || point.x > width + 24 || point.y > height + 24) continue
    const cluster = clusters.find(cluster => Math.hypot(cluster.point.x - point.x, cluster.point.y - point.y) < 30)
    if (cluster) cluster.markers.push(marker)
    else clusters.push({ point, markers: [marker] })
  }
  return clusters
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
