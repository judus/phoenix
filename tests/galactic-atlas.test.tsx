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
  expect(renderer.root.findByType('header').props.className).toContain('page-header-cockpit')
  expect(renderer.root.findByType('header').findAllByType('button')).toHaveLength(3)
  const zoomControls = renderer.root.findByProps({ 'aria-label': 'Atlas zoom controls' })
  expect(zoomControls.findAllByType('button').map(button => button.props['aria-label'])).toEqual(['Zoom out', 'Zoom in'])
  expect(renderer.root.findByProps({ className: 'atlas-viewport' }).findAllByType('button')).toHaveLength(0)
  const initial = renderer.root.findAllByType('g')[0].props.transform
  await act(async () => map().props.onKeyDown({ target: 1, currentTarget: 1, key: 'Home', preventDefault() {} }))
  const original = renderer.root.findAllByType('g')[0].props.transform
  expect(initial).not.toBe(original)
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
  expect(renderer.root.findAllByType('button').find(node => node.children.includes('Locate me'))).toBeUndefined()
  expect(JSON.stringify(renderer.toJSON())).toContain('waiting for journal coordinates')
  expect(renderer.root.findAllByProps({ className: 'atlas-marker commander' })).toHaveLength(0)
  await act(async () => renderer.unmount())
})

test('delayed coordinates centre the Atlas once without overriding subsequent navigation', async () => {
  let renderer: ReturnType<typeof create>
  const page = (position: [number, number, number] | null) => <GalacticAtlas bookmarks={[]} onNavigate={vi.fn()} onToggleBookmarks={vi.fn()} position={position} showBookmarks systemName="Sol" />
  await act(async () => { renderer = create(page(null)) })
  try {
    const transform = () => renderer.root.findAllByType('g')[0].props.transform
    const whole = transform()
    await act(async () => renderer.update(page([0, 0, 0])))
    expect(transform()).not.toBe(whole)
    const initial = transform()
    await act(async () => renderer.update(page([100, 0, 0])))
    expect(transform()).toBe(initial)
    const map = renderer.root.findAllByType('svg').find(node => node.props.role === 'group')!
    await act(async () => map.props.onKeyDown({ target: 1, currentTarget: 1, key: 'Home', preventDefault() {} }))
    await act(async () => renderer.update(page([200, 0, 0])))
    expect(transform()).toBe(whole)
  } finally { await act(async () => renderer.unmount()) }
})

test('manual Atlas navigation before coordinates arrive suppresses automatic centring', async () => {
  let renderer: ReturnType<typeof create>
  const page = (position: [number, number, number] | null) => <GalacticAtlas bookmarks={[]} onNavigate={vi.fn()} onToggleBookmarks={vi.fn()} position={position} showBookmarks systemName="Sol" />
  await act(async () => { renderer = create(page(null)) })
  try {
    const map = renderer.root.findAllByType('svg').find(node => node.props.role === 'group')!
    await act(async () => map.props.onKeyDown({ target: 1, currentTarget: 1, key: '+', preventDefault() {} }))
    const navigated = renderer.root.findAllByType('g')[0].props.transform
    await act(async () => renderer.update(page([0, 0, 0])))
    expect(renderer.root.findAllByType('g')[0].props.transform).toBe(navigated)
  } finally { await act(async () => renderer.unmount()) }
})

test('marker taps keep their native target and do not move the camera before a drag', async () => {
  let renderer: ReturnType<typeof create>
  await act(async () => {
    renderer = create(<GalacticAtlas bookmarks={[]} onNavigate={vi.fn()} onToggleBookmarks={vi.fn()} position={null} showBookmarks systemName={null} />)
  })
  const viewport = () => renderer.root.findByProps({ className: 'atlas-viewport' })
  const transform = () => renderer.root.findAllByType('g')[0].props.transform
  const marker = renderer.root.findAllByProps({ role: 'button' }).find(node => node.props['aria-label'] === 'Colonia')!
  const target = { setPointerCapture: vi.fn() }
  const element = { getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture: vi.fn() }
  const event = (x: number) => ({ pointerId: 1, pointerType: 'touch', button: 0, clientX: x, clientY: 100, currentTarget: element, target })
  const original = transform()
  await act(async () => viewport().props.onPointerDown(event(100)))
  await act(async () => viewport().props.onPointerMove(event(103)))
  await act(async () => viewport().props.onPointerUp(event(103)))
  const click = { detail: 1, preventDefault: vi.fn(), stopPropagation: vi.fn() }
  viewport().props.onClickCapture(click)
  expect(click.stopPropagation).not.toHaveBeenCalled()
  expect(element.setPointerCapture).not.toHaveBeenCalled()
  expect(target.setPointerCapture).not.toHaveBeenCalled()
  expect(transform()).toBe(original)
  await act(async () => marker.props.onClick())
  expect(renderer.root.findByProps({ 'aria-label': 'Selected atlas location' }).findByType('strong').children).toEqual(['Colonia'])
  await act(async () => renderer.unmount())
})

test('drag capture stays on the viewport when markers disappear and clears after capture loss', async () => {
  let renderer: ReturnType<typeof create>
  await act(async () => {
    renderer = create(<GalacticAtlas bookmarks={[]} onNavigate={vi.fn()} onToggleBookmarks={vi.fn()} position={null} showBookmarks systemName={null} />)
  })
  const viewport = () => renderer.root.findByProps({ className: 'atlas-viewport' })
  const transform = () => renderer.root.findAllByType('g')[0].props.transform
  const target = { setPointerCapture: vi.fn() }
  const element = { getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture: vi.fn() }
  const event = (x: number, pointerId = 1) => ({ pointerId, pointerType: 'mouse', button: 0, clientX: x, clientY: 100, currentTarget: element, target })
  await act(async () => viewport().props.onPointerDown(event(100)))
  await act(async () => viewport().props.onPointerMove(event(1800)))
  expect(element.setPointerCapture).toHaveBeenCalledWith(1)
  expect(target.setPointerCapture).not.toHaveBeenCalled()
  expect(renderer.root.findAllByProps({ role: 'button' })).toHaveLength(0)
  const dragged = transform()
  // Losing a child's implicit capture while transferring it must not end the gesture.
  await act(async () => viewport().props.onLostPointerCapture(event(1800)))
  await act(async () => viewport().props.onPointerMove(event(1850)))
  expect(transform()).not.toBe(dragged)
  const continued = transform()
  await act(async () => viewport().props.onLostPointerCapture({ ...event(1850), target: element }))
  await act(async () => viewport().props.onPointerMove(event(1900)))
  expect(transform()).toBe(continued)
  const click = { detail: 1, preventDefault: vi.fn(), stopPropagation: vi.fn() }
  viewport().props.onClickCapture(click)
  expect(click.stopPropagation).toHaveBeenCalledOnce()
  await act(async () => viewport().props.onPointerDown(event(100, 2)))
  await act(async () => viewport().props.onPointerMove(event(150, 2)))
  expect(transform()).not.toBe(continued)
  await act(async () => renderer.unmount())
})

test('pinch captures both pointers on the viewport and remaining fingers continue to pan', async () => {
  let renderer: ReturnType<typeof create>
  await act(async () => {
    renderer = create(<GalacticAtlas bookmarks={[]} onNavigate={vi.fn()} onToggleBookmarks={vi.fn()} position={null} showBookmarks systemName={null} />)
  })
  const viewport = () => renderer.root.findByProps({ className: 'atlas-viewport' })
  const transform = () => renderer.root.findAllByType('g')[0].props.transform as string
  const element = { getBoundingClientRect: () => ({ left: 0, top: 0 }), setPointerCapture: vi.fn() }
  const target = { setPointerCapture: vi.fn() }
  const event = (pointerId: number, x: number) => ({ pointerId, pointerType: 'touch', button: 0, clientX: x, clientY: 100, currentTarget: element, target })
  const original = transform()
  await act(async () => viewport().props.onPointerDown(event(1, 100)))
  await act(async () => viewport().props.onPointerDown(event(2, 200)))
  expect(element.setPointerCapture.mock.calls).toEqual([[1], [2]])
  await act(async () => viewport().props.onPointerMove(event(1, 80)))
  const pinched = transform()
  expect(pinched).not.toBe(original)
  const scale = pinched.match(/scale\(([^)]+)\)/)![1]
  await act(async () => viewport().props.onPointerUp(event(2, 200)))
  await act(async () => viewport().props.onPointerMove(event(1, 60)))
  expect(transform()).not.toBe(pinched)
  expect(transform()).toContain(`scale(${scale})`)
  await act(async () => viewport().props.onPointerCancel(event(1, 60)))
  await act(async () => viewport().props.onPointerDown(event(3, 100)))
  await act(async () => viewport().props.onPointerMove(event(3, 130)))
  expect(transform()).toContain(`scale(${scale})`)
  const keyboardClick = { detail: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() }
  viewport().props.onClickCapture(keyboardClick)
  expect(keyboardClick.stopPropagation).not.toHaveBeenCalled()
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
