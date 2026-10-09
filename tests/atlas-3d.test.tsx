import { act } from 'react-test-renderer'
import { expect, test, vi } from 'vitest'
import { atlasPlaneTransform, atlasScale, clusterAtlasMarkers, focusAtlas, LY_PER_MAP_UNIT, orbitAtlas,
  panAtlas, projectGalacticPosition, screenPoint, TILTED_VIEW, TOP_DOWN_VIEW, zoomAtlas } from '../apps/web/src/features/galaxy/galactic-atlas-model.js'
import { GalacticAtlas } from '../apps/web/src/features/galaxy/galactic-atlas-page.js'
import { renderWithAct } from './support/render-with-act.js'

test('top-down projection matches the original map and tilted projection uses true signed height', () => {
  const camera = { ...projectGalacticPosition([0, 0, 0]), zoom: 16 }
  const plane = projectGalacticPosition([100, 0, 200])
  const scale = atlasScale(900, 600, camera.zoom)
  const flat = screenPoint(plane, camera, 900, 600, TOP_DOWN_VIEW, 1000)
  expect(flat.x).toBeCloseTo(450 + (plane.x - camera.x) * scale)
  expect(flat.y).toBeCloseTo(300 + (plane.y - camera.y) * scale)
  const ground = screenPoint(plane, camera, 900, 600, TILTED_VIEW)
  const above = screenPoint(plane, camera, 900, 600, TILTED_VIEW, 1000)
  const below = screenPoint(plane, camera, 900, 600, TILTED_VIEW, -1000)
  expect(above.x).toBeCloseTo(ground.x)
  expect(ground.y - above.y).toBeCloseTo(1000 / LY_PER_MAP_UNIT * Math.sin(TILTED_VIEW.tilt) * scale)
  expect(below.y - ground.y).toBeCloseTo(ground.y - above.y)
})

test('reference-plane matrix agrees with point projection at every camera angle', () => {
  const camera = { x: 600, y: 1000, zoom: 8 }, point = { x: 620, y: 1100 }
  for (const view of [TOP_DOWN_VIEW, TILTED_VIEW, { azimuth: Math.PI / 2, tilt: Math.PI / 3 }]) {
    const [a, b, c, d, e, f] = atlasPlaneTransform(camera, 900, 600, view).slice(7, -1).split(' ').map(Number)
    const projected = screenPoint(point, camera, 900, 600, view)
    expect(a * point.x + c * point.y + e).toBeCloseTo(projected.x)
    expect(b * point.x + d * point.y + f).toBeCloseTo(projected.y)
  }
})

test('tilted pan follows screen direction, zoom anchors elevated points and focus centres their real position', () => {
  const position = [100, 1000, 200] as const
  const point = projectGalacticPosition(position)
  const camera = { x: point.x + 20, y: point.y - 40, zoom: 16 }
  const before = screenPoint(point, camera, 900, 600, TILTED_VIEW, position[1])
  const panned = screenPoint(point, panAtlas(camera, { x: 75, y: -20 }, 900, 600, TILTED_VIEW), 900, 600, TILTED_VIEW, position[1])
  expect(panned.x - before.x).toBeCloseTo(75)
  expect(panned.y - before.y).toBeCloseTo(-20)
  const zoomed = screenPoint(point, zoomAtlas(camera, 2, before, 900, 600, TILTED_VIEW), 900, 600, TILTED_VIEW, position[1])
  expect(zoomed.x).toBeCloseTo(before.x)
  expect(zoomed.y).toBeCloseTo(before.y)
  const centred = screenPoint(point, focusAtlas(position, 16, TILTED_VIEW), 900, 600, TILTED_VIEW, position[1])
  expect(centred.x).toBeCloseTo(450)
  expect(centred.y).toBeCloseTo(300)
})

test('orbit rotates the map and bounds tilt away from the singular edge-on plane', () => {
  const left = orbitAtlas(TILTED_VIEW, { x: -100, y: -10000 })
  const right = orbitAtlas(TILTED_VIEW, { x: 100, y: 10000 })
  expect(left.azimuth).toBeLessThan(TILTED_VIEW.azimuth)
  expect(right.azimuth).toBeGreaterThan(TILTED_VIEW.azimuth)
  expect(left.tilt).toBeCloseTo(Math.PI / 18)
  expect(right.tilt).toBeCloseTo(Math.PI * 7 / 18)
})

test('height separates projected neighbours in 3D and preserves both members when flattened', () => {
  const markers = [0, 1000].map(height => ({ id: `${height}`, label: `${height}`, systemName: 'Synthetic',
    position: [0, height, 0] as const, kind: 'bookmark' as const }))
  const camera = focusAtlas([0, 0, 0], 16)
  expect(clusterAtlasMarkers(markers, camera, 900, 600)).toHaveLength(1)
  const tilted = clusterAtlasMarkers(markers, camera, 900, 600, TILTED_VIEW)
  expect(tilted).toHaveLength(2)
  expect(tilted.map(cluster => cluster.depth)).toEqual([...tilted.map(cluster => cluster.depth)].sort((a, b) => a - b))
  expect(tilted[1].point.y).toBeLessThan(tilted[1].ground.y)
})

test('3D controls preserve selection, orbit with one finger, pinch with two and restore top-down', async () => {
  const marker = { id: 'high', label: 'Elevated POI', systemName: 'High', position: [0, 10000, 0] as const, kind: 'bookmark' as const }
  const renderer = await renderWithAct(<GalacticAtlas bookmarks={[marker]} onNavigate={vi.fn()} onToggleBookmarks={vi.fn()}
    position={[0, 0, 0]} showBookmarks systemName="Sol" />)
  const plane = () => renderer.root.findByProps({ className: 'atlas-plane' }).props.transform
  const viewport = () => renderer.root.findByProps({ className: 'atlas-viewport' })
  const element = { getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture: vi.fn() }
  const event = (pointerId: number, x: number, y = 100) => ({ pointerId, pointerType: 'touch', button: 0,
    clientX: x, clientY: y, currentTarget: element, target: element })
  try {
    const initial = plane()
    await act(async () => renderer.root.findByProps({ 'aria-label': '3D atlas view' }).props.onClick())
    expect(plane()).not.toBe(initial)
    expect(renderer.root.findAllByProps({ className: 'atlas-height' }).length).toBeGreaterThan(0)
    await act(async () => renderer.root.findByProps({ 'aria-label': marker.label }).props.onClick())
    expect(renderer.root.findAllByProps({ 'aria-label': 'Selected atlas location' })).toHaveLength(1)
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Orbit atlas camera' }).props.onClick())
    const tilted = plane()
    await act(async () => viewport().props.onPointerDown(event(1, 100)))
    await act(async () => viewport().props.onPointerMove(event(1, 160, 120)))
    expect(plane()).not.toBe(tilted)
    await act(async () => viewport().props.onPointerDown(event(2, 260, 120)))
    const orbited = plane()
    await act(async () => viewport().props.onPointerMove(event(2, 300, 120)))
    expect(plane()).not.toBe(orbited)
    expect(renderer.root.findAllByProps({ 'aria-label': 'Selected atlas location' })).toHaveLength(1)
    await act(async () => viewport().props.onPointerUp(event(1, 160)))
    await act(async () => viewport().props.onPointerUp(event(2, 300)))
    await act(async () => renderer.root.findByProps({ 'aria-label': '3D atlas view' }).props.onClick())
    expect(renderer.root.findAllByProps({ className: 'atlas-height' })).toHaveLength(0)
    expect(renderer.root.findAllByProps({ 'aria-label': 'Orbit atlas camera' })).toHaveLength(0)
    expect(renderer.root.findAllByProps({ 'aria-label': 'Selected atlas location' })).toHaveLength(1)
  } finally { await act(async () => renderer.unmount()) }
})
