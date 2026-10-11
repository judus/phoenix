import { act } from 'react-test-renderer'
import { expect, test, vi } from 'vitest'
import type { NavigationRoute } from '@phoenix/contracts'
import { atlasNavigationRoute, clusterAtlasMarkers, MAX_ATLAS_ZOOM, projectGalacticPosition, screenPoint, TILTED_VIEW, TOP_DOWN_VIEW, zoomAtlas } from '../apps/web/src/features/galaxy/galactic-atlas-model.js'
import { GalacticAtlas } from '../apps/web/src/features/galaxy/galactic-atlas-page.js'
import { renderWithAct } from './support/render-with-act.js'

const route: NavigationRoute = { timestamp: null, route: [
  { system: 'Start', address: 1, position: [0, 0, 0], starClass: 'G' },
  { system: 'Current', address: 2, position: [4000, 1000, 0], starClass: 'K' },
  { system: 'Next', address: 3, position: [10000, -500, 0], starClass: 'M' },
  { system: 'End', address: 4, position: [12000, 500, 0], starClass: 'A' }
] }

test.each([TOP_DOWN_VIEW, TILTED_VIEW])('close zoom separates five-LY stops and keeps the pointer anchor stable at the ceiling (%j)', view => {
  const short: NavigationRoute = { timestamp: null, route: route.route.slice(0, 2).map((hop, index) => ({ ...hop, position: [index * 5, 0, 0] })) }
  const markers = atlasNavigationRoute(short, null).markers
  const camera = { ...projectGalacticPosition([0, 0, 0]), zoom: 128 }
  expect(clusterAtlasMarkers(markers, camera, 900, 600, view)).toHaveLength(1)
  const point = projectGalacticPosition([5, 0, 0])
  const anchor = screenPoint(point, camera, 900, 600, view)
  const closer = zoomAtlas(camera, 100, anchor, 900, 600, view)
  expect(closer.zoom).toBe(MAX_ATLAS_ZOOM)
  const projected = screenPoint(point, closer, 900, 600, view)
  expect(projected.x).toBeCloseTo(anchor.x)
  expect(projected.y).toBeCloseTo(anchor.y)
  expect(clusterAtlasMarkers(markers, closer, 900, 600, view)).toHaveLength(2)
  expect(zoomAtlas(closer, 2, anchor, 900, 600, view)).toEqual(closer)
})

test('route model preserves ordered legs, known progress, heights and unlocated gaps', () => {
  const plotted = atlasNavigationRoute(route, ' CURRENT ')
  expect(plotted.currentIndex).toBe(1)
  expect(plotted.legs.map(leg => leg.completed)).toEqual([true, false, false])
  expect(plotted.markers[1]!.routeStop).toMatchObject({ current: true, index: 1 })
  expect(plotted.markers.at(-1)!.routeStop?.destination).toBe(true)
  expect(plotted.legs[1]!.to[1]).toBe(-500)
  expect(atlasNavigationRoute(route, 'Elsewhere').legs.every(leg => !leg.completed)).toBe(true)
  const missing = { ...route, route: route.route.map((hop, index) => index === 1 ? { ...hop, position: null } : hop) }
  const gaps = atlasNavigationRoute(missing, 'Current')
  expect(gaps.missingCoordinates).toBe(1)
  expect(gaps.markers.map(marker => marker.systemName)).toEqual(['Start', 'Next', 'End'])
  expect(gaps.legs.map(leg => leg.index)).toEqual([3])
  expect(atlasNavigationRoute({ timestamp: null, route: [] }, null)).toMatchObject({ markers: [], legs: [], currentIndex: -1 })
})

test('Atlas toggles route, selects stops, updates progress without moving camera and projects tilted legs', async () => {
  const onNavigate = vi.fn()
  const props = { bookmarks: [], onNavigate, onToggleBookmarks: vi.fn(), position: [4000, 1000, 0] as const,
    showBookmarks: false, systemName: 'Current', navigationRoute: route }
  const renderer = await renderWithAct(<GalacticAtlas {...props} />)
  const plane = () => renderer.root.findByProps({ className: 'atlas-plane' }).props.transform
  const legs = () => renderer.root.findByProps({ 'aria-label': 'Plotted jump legs' }).findAllByType('path')
  const toggle = () => renderer.root.findByProps({ 'aria-label': 'Plotted route' })
  try {
    expect(legs()).toHaveLength(3)
    expect(legs().map(node => node.props.className)).toEqual(['completed', undefined, undefined])
    const next = renderer.root.findByProps({ role: 'button', 'aria-label': 'Next' })
    expect(next.findByType('text').children).toEqual(['Next'])
    await act(async () => next.props.onClick())
    const inspector = () => renderer.root.findByProps({ 'aria-label': 'Selected atlas location' })
    expect(JSON.stringify(renderer.toJSON())).toContain('Jump 2')
    const link = inspector().findByType('a')
    await act(async () => link.props.onClick({ button: 0, preventDefault() {} }))
    expect(onNavigate).toHaveBeenCalledWith({ kind: 'information', section: 'galaxy', view: 'system', systemName: 'Next' })
    const before = plane()
    await act(async () => renderer.update(<GalacticAtlas {...props} systemName="Next" />))
    expect(plane()).toBe(before)
    expect(legs().map(node => node.props.className)).toEqual(['completed', 'completed', undefined])
    await act(async () => renderer.root.findByProps({ 'aria-label': '3D atlas view' }).props.onClick())
    const camera = { ...projectGalacticPosition(props.position), zoom: 4 }
    const from = screenPoint(projectGalacticPosition(route.route[1]!.position!), camera, 900, 600, TILTED_VIEW, 1000)
    const to = screenPoint(projectGalacticPosition(route.route[2]!.position!), camera, 900, 600, TILTED_VIEW, -500)
    expect(legs()[1]!.props.d).toBe(`M${from.x},${from.y}L${to.x},${to.y}`)
    await act(async () => toggle().props.onClick())
    expect(toggle().props.pressed).toBe(false)
    expect(renderer.root.findAllByProps({ 'aria-label': 'Plotted jump legs' })).toHaveLength(0)
    expect(renderer.root.findAllByProps({ 'aria-label': 'Selected atlas location' })).toHaveLength(0)
    await act(async () => toggle().props.onClick())
    const tilted = plane()
    await act(async () => renderer.update(<GalacticAtlas {...props} navigationRoute={{ timestamp: null, route: [] }} />))
    expect(legs()).toHaveLength(0)
    expect(plane()).toBe(tilted)
    expect(JSON.stringify(renderer.toJSON())).toContain('No route plotted.')
  } finally { await act(async () => renderer.unmount()) }
})
