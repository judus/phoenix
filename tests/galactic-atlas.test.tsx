import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { parsePhoenixRoute, phoenixRouteHash } from '../apps/web/src/application/navigation/phoenix-router.js'
import { GalacticAtlas, GalacticAtlasPage } from '../apps/web/src/features/galaxy/galactic-atlas-page.js'
import { ATLAS_LANDMARKS, WHOLE_GALAXY, atlasScale, clusterAtlasMarkers, distanceLy, galacticRegion, projectGalacticPosition, screenPoint, zoomAtlas } from '../apps/web/src/features/galaxy/galactic-atlas-model.js'
import { atlasRegions } from '../apps/web/src/features/galaxy/atlas-region-data.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('atlas routing round-trips and physical coordinates identify known regions', () => {
  const route = { kind: 'information', section: 'galaxy', view: 'atlas' } as const
  expect(parsePhoenixRoute(phoenixRouteHash(route))).toEqual(route)
  expect(atlasRegions).toHaveLength(42)
  expect(galacticRegion([0, 0, 0])?.name).toBe('Inner Orion Spur')
  expect(galacticRegion(ATLAS_LANDMARKS.find(marker => marker.id === 'colonia')!.position)?.name).toBe('Inner Scutum-Centaurus Arm')
  expect(galacticRegion(ATLAS_LANDMARKS.find(marker => marker.id === 'sagittarius')!.position)?.name).toBe('Galactic Centre')
  expect(galacticRegion([0, 20000, 0])?.id).toBe(galacticRegion([0, 0, 0])?.id)
  expect(galacticRegion([-100000, 0, 0])).toBeUndefined()
  expect(galacticRegion([0, 0, 100000])).toBeUndefined()
  expect(projectGalacticPosition([0, 0, 1000]).y).toBeLessThan(projectGalacticPosition([0, 0, 0]).y)
  expect(distanceLy([0, 0, 0], [0, 100, 0])).toBe(100)
})

test('zoom holds the pointer anchor fixed and clamps scale', () => {
  const camera = { ...WHOLE_GALAXY, zoom: 2 }
  const anchor = { x: 170, y: 240 }
  const scale = atlasScale(900, 600, camera.zoom)
  const point = { x: camera.x + (anchor.x - 450) / scale, y: camera.y + (anchor.y - 300) / scale }
  const after = screenPoint(point, zoomAtlas(camera, 1.5, anchor, 900, 600), 900, 600)
  expect(after.x).toBeCloseTo(anchor.x)
  expect(after.y).toBeCloseTo(anchor.y)
  expect(zoomAtlas(camera, 10000, anchor, 900, 600).zoom).toBe(64)
  expect(zoomAtlas(camera, 0.001, anchor, 900, 600).zoom).toBe(1)
})

test('nearby landmarks cluster without losing selectable locations', () => {
  const clusters = clusterAtlasMarkers(ATLAS_LANDMARKS, WHOLE_GALAXY, 900, 600)
  const sol = clusters.find(cluster => cluster.markers.some(marker => marker.id === 'sol'))!
  expect(sol.markers.map(marker => marker.id)).toContain('orion')
  expect(clusters.flatMap(cluster => cluster.markers)).toHaveLength(ATLAS_LANDMARKS.length)
})

test('atlas selection opens the correct system and supports keyboard zoom and reset', async () => {
  const onNavigate = vi.fn()
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<GalacticAtlas bookmarks={[]} onNavigate={onNavigate} onToggleBookmarks={vi.fn()} position={[0, 0, 0]} showBookmarks systemName="Sol" />) })
  const map = () => renderer.root.findAllByType('svg').find(node => node.props.role === 'group')!
  expect(renderer.root.findByType('header').findAllByType('button')).toHaveLength(5)
  const zoomControls = renderer.root.findByProps({ 'aria-label': 'Atlas zoom controls' })
  expect(zoomControls.findAllByType('button').map(button => button.props['aria-label'])).toEqual(['Zoom out', 'Zoom in'])
  expect(renderer.root.findByProps({ className: 'atlas-viewport' }).findAllByType('button')).toHaveLength(0)
  const original = renderer.root.findAllByType('g')[0].props.transform
  await act(async () => renderer.root.findAllByProps({ role: 'button' }).find(node => node.props['aria-label'] === 'Colonia')!.props.onClick())
  await act(async () => renderer.root.findAllByType('button').find(node => node.children.includes('Open system schematic'))!.props.onClick())
  expect(onNavigate).toHaveBeenCalledWith({ kind: 'information', section: 'galaxy', view: 'system', systemName: 'Colonia' })
  await act(async () => map().props.onKeyDown({ target: 1, currentTarget: 1, key: '+', preventDefault() {} }))
  expect(renderer.root.findAllByType('g')[0].props.transform).not.toBe(original)
  await act(async () => map().props.onKeyDown({ target: 1, currentTarget: 1, key: 'Home', preventDefault() {} }))
  expect(renderer.root.findAllByType('g')[0].props.transform).toBe(original)
  expect(renderer.root.findByProps({ className: 'galactic-atlas' }).props['data-deskplane-no-swipe']).toBe(true)
  await act(async () => renderer.unmount())
})

test('missing journal position never becomes a fabricated Sol position', async () => {
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<GalacticAtlas bookmarks={[]} onNavigate={vi.fn()} onToggleBookmarks={vi.fn()} position={null} showBookmarks systemName={null} />) })
  expect(renderer.root.findAllByType('button').find(node => node.children.includes('Locate me'))!.props.disabled).toBe(true)
  expect(JSON.stringify(renderer.toJSON())).toContain('waiting for journal coordinates')
  expect(renderer.root.findAllByProps({ className: 'atlas-marker commander' })).toHaveLength(0)
  await act(async () => renderer.unmount())
})

test('bookmarks deduplicate system lookups, preserve station/body targets and report missing coordinates', async () => {
  const bookmark = (id: string, target: object) => ({ id, target, tags: [], note: null, createdAt: '', updatedAt: '' })
  const api = {
    getGalaxyBookmarks: vi.fn().mockResolvedValue({ bookmarks: [
      bookmark('station', { kind: 'station', systemName: 'Example', stationName: 'Test Port' }),
      bookmark('body', { kind: 'body', systemName: 'Example', bodyName: 'Example 2' }),
      bookmark('missing', { kind: 'system', systemName: 'Unresolved' })
    ] }),
    getSystemCartography: vi.fn(async (name: string) => {
      if (name === 'Unresolved') throw new Error('Offline')
      return { system: { position: [18000, 50, 40000] } }
    })
  } as unknown as PhoenixApi
  const onNavigate = vi.fn()
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<GalacticAtlasPage api={api} onNavigate={onNavigate} runtime={{ status: 'ready', state: createEmptyRuntimeState() }} />) })
  expect(api.getSystemCartography).toHaveBeenCalledTimes(2)
  expect(JSON.stringify(renderer.toJSON())).toContain('1 bookmark without coordinates')
  await act(async () => renderer.root.findAllByProps({ role: 'button' }).find(node => node.props['aria-label'] === '2 locations near Test Port')!.props.onClick())
  await act(async () => renderer.root.findByType('select').props.onChange({ target: { value: 'body' } }))
  await act(async () => renderer.root.findAllByType('button').find(node => node.children.includes('Open system schematic'))!.props.onClick())
  expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ systemName: 'Example', selectedName: 'Example 2' }))
  await act(async () => renderer.unmount())
})
