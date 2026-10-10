import { renderWithAct } from './support/render-with-act.js'
import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { parsePhoenixRoute, phoenixRouteHash } from '../apps/web/src/application/navigation/phoenix-router.js'
import { GalacticAtlas, GalacticAtlasPage } from '../apps/web/src/features/galaxy/galactic-atlas-page.js'
import { ATLAS_LANDMARKS, WHOLE_GALAXY, atlasPoiMarkers, filterAtlasPois, atlasScale, clusterAtlasMarkers, distanceLy, galacticRegion, projectGalacticPosition, screenPoint, zoomAtlas } from '../apps/web/src/features/galaxy/galactic-atlas-model.js'
import { atlasRegions } from '../apps/web/src/features/galaxy/atlas-region-data.js'
import { atlasNoteTarget, type AtlasMarker } from '../apps/web/src/features/galaxy/galactic-atlas-model.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('Atlas note targets use known entities, never infer a station from a site label', () => {
  const base: AtlasMarker = { id: 'site', label: 'Crash site', systemName: 'Sol', position: [0, 0, 0], kind: 'landmark' }
  expect(atlasNoteTarget(base)).toEqual({ kind: 'system', systemName: 'Sol' })
  const poi = atlasPoiMarkers([{ id: 'site', label: 'Crash site', systemName: 'Sol', bodyName: 'A 1',
    position: [0, 0, 0], categories: ['Historical sites'], source: 'Synthetic', sourceUrl: 'https://example.com' }])[0]!
  expect(atlasNoteTarget(poi)).toEqual({ kind: 'body', systemName: 'Sol', bodyName: 'Sol A 1' })
  expect(atlasNoteTarget({ ...base, kind: 'bookmark', bookmarkTarget: { kind: 'station', systemName: 'Sol', stationName: 'Galileo' } }))
    .toEqual({ kind: 'station', systemName: 'Sol', stationName: 'Galileo' })
})

test('display destinations centre and select the Atlas, repeat while open, and do not override later user interaction', async () => {
  const location = { systemName: 'Colonia', position: [-9530, -910, 19808] as [number, number, number] }
  const props = { bookmarks: [], onNavigate: vi.fn(), onToggleBookmarks: vi.fn(), position: null, showBookmarks: false, systemName: null, location, displayRequestId: 'first' }
  const renderer = await renderWithAct(<GalacticAtlas {...props} />)
  const transform = () => renderer.root.findAllByType('g')[0].props.transform
  const inspector = () => renderer.root.findByProps({ 'aria-label': 'Selected atlas location' })
  try {
    expect(inspector().findByType('h2').props.children).toBe('Colonia')
    expect(renderer.root.findAllByProps({ 'aria-label': 'Colonia' })).toHaveLength(1)
    expect(renderer.root.findAllByProps({ 'aria-label': '2 locations near Colonia' })).toHaveLength(0)
    expect(inspector().findAllByType('a')[0].props.href).toBe('#/galaxy/system?name=Colonia')
    await act(async () => inspector().findAllByType('button').find(button => button.props['aria-label'] === 'Add note for Colonia')!.props.onClick())
    expect(props.onNavigate).toHaveBeenLastCalledWith({ kind: 'notes', newNote: true, target: { kind: 'system', systemName: 'Colonia' } })
    const centred = transform()
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Zoom in' }).props.onClick())
    expect(transform()).not.toBe(centred)
    // Late player telemetry must not steal an explicit destination.
    await act(async () => renderer.update(<GalacticAtlas {...props} position={[0, 0, 0]} systemName="Sol" />))
    expect(transform()).not.toBe(centred)
    await act(async () => renderer.update(<GalacticAtlas {...props} position={[0, 0, 0]} systemName="Sol" displayRequestId="second" />))
    expect(transform()).toBe(centred)
    const next = { systemName: 'Sagittarius A*', position: [25, -20, 25900] as [number, number, number] }
    await act(async () => renderer.update(<GalacticAtlas {...props} location={next} displayRequestId="third" />))
    expect(transform()).not.toBe(centred)
    expect(inspector().findByType('h2').props.children).toBe('Sagittarius A*')
    await act(async () => renderer.update(<GalacticAtlas {...props} location={undefined} displayRequestId={undefined} />))
    expect(renderer.root.findAllByType('aside')).toHaveLength(0)
  } finally { await act(async () => renderer.unmount()) }
})

test('catalogue filtering preserves site identities and body targeting; dense clusters retain every location', () => {
  const pois = atlasPoiMarkers(Array.from({ length: 1500 }, (_, index) => ({
    id: `synthetic:${index}`, label: `Site ${index}`, systemName: 'Example', position: [10, 20, 30] as [number, number, number],
    categories: [index % 2 ? 'Guardian Ruins' : 'Guardian Structures'], source: 'Synthetic', sourceUrl: 'https://example.com/site', bodyName: 'A 1', siteType: 'Turtle'
  })))
  expect(filterAtlasPois(pois, ' turtle ', 'Guardian Structures')).toHaveLength(750)
  expect(filterAtlasPois(pois, 'not present', '')).toHaveLength(0)
  expect(pois[0]?.selectedName).toBe('Example A 1')
  expect(clusterAtlasMarkers(pois, WHOLE_GALAXY, 900, 600).flatMap(cluster => cluster.markers)).toHaveLength(1500)
})

test('search can locate an off-screen POI without enabling the catalogue, inspect provenance and retain filters', async () => {
  const catalogue = { pois: [{ id: 'synthetic:1', label: 'Remote site', systemName: 'Remote', position: [20000, 0, 40000] as [number, number, number], categories: ['Guardian Structures'], source: 'Synthetic feed', sourceUrl: 'https://example.com/site', bodyName: 'A 1', siteType: 'Turtle' }], sources: [] }
  const onNavigate = vi.fn()
  const renderer = await renderWithAct(<GalacticAtlas catalogue={catalogue} bookmarks={[]} onNavigate={onNavigate} onToggleBookmarks={vi.fn()} position={[0, 0, 0]} showBookmarks systemName="Sol" />)
  try {
    expect(renderer.root.findAllByType('aside')).toHaveLength(0)
    expect(renderer.root.findAllByProps({ id: 'atlas-poi-search' })).toHaveLength(0)
    const headerButtons = () => renderer.root.findAllByType('header')[0].findAllByType('button')
    expect(headerButtons().map(button => button.props.children)).toEqual(['Regions', 'Bookmarks', 'Route', 'Landmarks', 'Finder'])
    const finder = () => headerButtons().find(button => button.props.children === 'Finder')!
    await act(async () => finder().props.onClick())
    const reset = () => renderer.root.findAllByType('button').find(button => button.props.children === 'Clear')!
    const clearRow = renderer.root.findAllByType('div').find(node => node.props.className?.startsWith('inline ') && node.findAllByType('button').some(button => button.props.children === 'Clear'))!
    expect(clearRow.findByProps({ role: 'status' }).props.children).toBe('9 POIs')
    expect(clearRow.props.className).toContain('justify-space-between')
    expect(clearRow.findAll(node => node.type === 'small' || node.type === 'button').map(node => node.type)).toEqual(['small', 'button'])
    expect(reset().props.disabled).toBe(true)
    const initial = renderer.root.findAllByType('g')[0].props.transform
    const category = renderer.root.findByProps({ id: 'atlas-poi-category' })
    await act(async () => category.props.onChange({ target: { value: 'Guardian Structures' } }))
    const locations = renderer.root.findByProps({ id: 'atlas-poi-location' })
    expect(locations.findAllByType('option')).toHaveLength(2)
    await act(async () => locations.props.onChange({ target: { value: 'synthetic:1' } }))
    expect(renderer.root.findAllByType('g')[0].props.transform).not.toBe(initial)
    const inspector = renderer.root.findByProps({ 'aria-label': 'Selected atlas location' })
    expect(JSON.stringify(renderer.toJSON())).toContain('Not reported by this source')
    expect(inspector.findAllByType('a').find(node => node.props.href === 'https://example.com/site')).toBeDefined()
    await act(async () => inspector.findAllByType('a')[0]!.props.onClick({ button: 0, preventDefault() {} }))
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ systemName: 'Remote', selectedName: 'Remote A 1' }))
    await act(async () => renderer.root.findByProps({ id: 'atlas-poi-search' }).props.onChange({ target: { value: 'not present' } }))
    expect(renderer.root.findAllByProps({ 'aria-label': 'Selected atlas location' })).toHaveLength(0)
    expect(renderer.root.findAllByProps({ 'aria-label': 'Find atlas POI' })).toHaveLength(1)
    expect(headerButtons().map(button => button.props.children)).toContain('Landmarks · filtered')
    await act(async () => finder().props.onClick())
    expect(renderer.root.findAllByType('aside')).toHaveLength(0)
    await act(async () => finder().props.onClick())
    expect(renderer.root.findByProps({ id: 'atlas-poi-search' }).props.value).toBe('not present')
    expect(renderer.root.findByProps({ id: 'atlas-poi-category' }).props.value).toBe('Guardian Structures')
    await act(async () => reset().props.onClick())
    expect(renderer.root.findByProps({ id: 'atlas-poi-search' }).props.value).toBe('')
    expect(renderer.root.findByProps({ id: 'atlas-poi-category' }).props.value).toBe('')
    expect(reset().props.disabled).toBe(true)
    expect(headerButtons().map(button => button.props.children)).toContain('Landmarks')
  } finally { await act(async () => renderer.unmount()) }
})

test('catalogue markers are opt-in while reference landmarks stay available', async () => {
  const catalogue = { pois: [{ id: 'synthetic:visible', label: 'Visible catalogue site', systemName: 'Example', position: [20000, 0, 20000] as [number, number, number], categories: ['Guardian Ruins'], source: 'Synthetic', sourceUrl: 'https://example.com/site' }], sources: [] }
  const renderer = await renderWithAct(<GalacticAtlas catalogue={catalogue} bookmarks={[]} onNavigate={vi.fn()} onToggleBookmarks={vi.fn()} position={null} showBookmarks systemName={null} />)
  try {
    const site = () => renderer.root.findAllByProps({ 'aria-label': 'Visible catalogue site' })
    const toggle = renderer.root.findAllByType('button').find(button => button.props.children === 'Landmarks')!
    expect(toggle.props['aria-pressed']).toBe(false)
    expect(site()).toHaveLength(0)
    await act(async () => toggle.props.onClick())
    expect(site()).toHaveLength(1)
    await act(async () => toggle.props.onClick())
    expect(site()).toHaveLength(0)
    expect(renderer.root.findAllByProps({ 'aria-label': 'Colonia' })).toHaveLength(1)
  } finally { await act(async () => renderer.unmount()) }
})

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
  expect(zoomAtlas(camera, 10000, anchor, 900, 600).zoom).toBe(2048)
  expect(zoomAtlas(camera, 0.001, anchor, 900, 600).zoom).toBe(1)
})

test('nearby landmarks cluster without losing selectable locations', () => {
  const clusters = clusterAtlasMarkers(ATLAS_LANDMARKS, WHOLE_GALAXY, 900, 600)
  const sol = clusters.find(cluster => cluster.markers.some(marker => marker.id === 'sol'))!
  expect(sol.markers.map(marker => marker.id)).toContain('orion')
  expect(clusters.flatMap(cluster => cluster.markers)).toHaveLength(ATLAS_LANDMARKS.length)
})

test('closer zoom separates nearby Bubble markers that shared a cluster at the previous limit', () => {
  const position = [0, 0, 0] as const
  const markers = [
    { id: 'a', label: 'A', systemName: 'A', position, kind: 'bookmark' as const },
    { id: 'b', label: 'B', systemName: 'B', position: [50, 0, 0] as const, kind: 'bookmark' as const }
  ]
  const camera = { ...projectGalacticPosition(position), zoom: 64 }
  expect(clusterAtlasMarkers(markers, camera, 900, 600)).toHaveLength(1)
  const closer = zoomAtlas(camera, 2, { x: 450, y: 300 }, 900, 600)
  expect(clusterAtlasMarkers(markers, closer, 900, 600)).toHaveLength(2)
})

test('atlas zoom controls allow the extended range and disable at its ceiling', async () => {
  const renderer = await renderWithAct(<GalacticAtlas bookmarks={[]} onNavigate={vi.fn()} onToggleBookmarks={vi.fn()} position={[0, 0, 0]} showBookmarks systemName="Sol" />)
  try {
    const zoomIn = () => renderer.root.findByProps({ 'aria-label': 'Zoom in' })
    for (let step = 0; step < 16; step++) {
      expect(zoomIn().props.disabled).toBe(false)
      await act(async () => zoomIn().props.onClick())
    }
    expect(zoomIn().props.disabled).toBe(true)
    await act(async () => renderer.root.findByProps({ 'aria-label': 'Zoom out' }).props.onClick())
    expect(zoomIn().props.disabled).toBe(false)
  } finally {
    await act(async () => renderer.unmount())
  }
})

test('atlas selection opens the correct system and supports keyboard zoom and reset', async () => {
  const onNavigate = vi.fn()
  const renderer = await renderWithAct(<GalacticAtlas bookmarks={[]} onNavigate={onNavigate} onToggleBookmarks={vi.fn()} position={[0, 0, 0]} showBookmarks systemName="Sol" />)
  const map = () => renderer.root.findAllByType('svg').find(node => node.props.role === 'group')!
  const pageHeader = renderer.root.findAllByType('header')[0]
  expect(pageHeader.props.className).toContain('page-header-cockpit')
  expect(pageHeader.findAllByType('button')).toHaveLength(5)
  const currentSystem = renderer.root.findByType('footer').findByType('a')
  expect(parsePhoenixRoute(currentSystem.props.href)).toEqual({ kind: 'information', section: 'galaxy', view: 'system', systemName: 'Sol' })
  await act(async () => currentSystem.props.onClick({ button: 0, preventDefault() {} }))
  expect(onNavigate).toHaveBeenCalledWith({ kind: 'information', section: 'galaxy', view: 'system', systemName: 'Sol' })
  const zoomControls = renderer.root.findByProps({ 'aria-label': 'Atlas zoom controls' })
  expect(zoomControls.findAllByType('button').map(button => button.props['aria-label'])).toEqual(['3D atlas view', 'Zoom out', 'Zoom in'])
  expect(renderer.root.findByProps({ className: 'atlas-viewport' }).findAllByType('button')).toHaveLength(0)
  const initial = renderer.root.findAllByType('g')[0].props.transform
  await act(async () => map().props.onKeyDown({ target: 1, currentTarget: 1, key: 'Home', preventDefault() {} }))
  const original = renderer.root.findAllByType('g')[0].props.transform
  expect(initial).not.toBe(original)
  await act(async () => renderer.root.findAllByProps({ role: 'button' }).find(node => node.props['aria-label'] === 'Colonia')!.props.onClick())
  const inspector = renderer.root.findByProps({ 'aria-label': 'Selected atlas location' })
  expect(renderer.root.findByProps({ 'aria-label': 'Galactic atlas' }).props.className).toContain('has-selection')
  await act(async () => inspector.findByType('a').props.onClick({ button: 0, preventDefault() {} }))
  expect(onNavigate).toHaveBeenCalledWith({ kind: 'information', section: 'galaxy', view: 'system', systemName: 'Colonia' })
  await act(async () => map().props.onKeyDown({ target: 1, currentTarget: 1, key: '+', preventDefault() {} }))
  expect(renderer.root.findAllByType('g')[0].props.transform).not.toBe(original)
  await act(async () => map().props.onKeyDown({ target: 1, currentTarget: 1, key: 'Home', preventDefault() {} }))
  expect(renderer.root.findAllByType('g')[0].props.transform).toBe(original)
  expect(renderer.root.findByProps({ 'aria-label': 'Galactic atlas' }).props['data-deskplane-no-swipe']).toBe(true)
  expect(inspector.findAllByType('button').some(button => button.props['aria-label'] === 'Close atlas selection')).toBe(false)
  const viewport = renderer.root.findByProps({ className: 'atlas-viewport' })
  await act(async () => viewport.props.onClick({ target: { closest: () => ({}) } }))
  expect(renderer.root.findAllByType('aside')).toHaveLength(1)
  await act(async () => viewport.props.onClick({ target: { closest: () => null } }))
  expect(renderer.root.findAllByType('aside')).toHaveLength(0)
  expect(renderer.root.findByProps({ 'aria-label': 'Galactic atlas' }).props.className).not.toContain('has-selection')
  await act(async () => renderer.unmount())
})

test('missing journal position never becomes a fabricated Sol position', async () => {
  const renderer = await renderWithAct(<GalacticAtlas bookmarks={[]} onNavigate={vi.fn()} onToggleBookmarks={vi.fn()} position={null} showBookmarks systemName={null} />)
  expect(renderer.root.findAllByType('button').find(node => node.children.includes('Locate me'))).toBeUndefined()
  expect(JSON.stringify(renderer.toJSON())).toContain('waiting for journal coordinates')
  expect(renderer.root.findAllByProps({ className: 'atlas-marker commander' })).toHaveLength(0)
  await act(async () => renderer.unmount())
})

test('delayed coordinates centre the Atlas once without overriding subsequent navigation', async () => {
  const page = (position: [number, number, number] | null) => <GalacticAtlas bookmarks={[]} onNavigate={vi.fn()} onToggleBookmarks={vi.fn()} position={position} showBookmarks systemName="Sol" />
  const renderer = await renderWithAct(page(null))
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
  const page = (position: [number, number, number] | null) => <GalacticAtlas bookmarks={[]} onNavigate={vi.fn()} onToggleBookmarks={vi.fn()} position={position} showBookmarks systemName="Sol" />
  const renderer = await renderWithAct(page(null))
  try {
    const map = renderer.root.findAllByType('svg').find(node => node.props.role === 'group')!
    await act(async () => map.props.onKeyDown({ target: 1, currentTarget: 1, key: '+', preventDefault() {} }))
    const navigated = renderer.root.findAllByType('g')[0].props.transform
    await act(async () => renderer.update(page([0, 0, 0])))
    expect(renderer.root.findAllByType('g')[0].props.transform).toBe(navigated)
  } finally { await act(async () => renderer.unmount()) }
})

test('marker taps keep their native target and do not move the camera before a drag', async () => {
  const renderer = await renderWithAct(<GalacticAtlas bookmarks={[]} onNavigate={vi.fn()} onToggleBookmarks={vi.fn()} position={null} showBookmarks systemName={null} />)
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
  expect(renderer.root.findByProps({ 'aria-label': 'Selected atlas location' }).findByType('h2').children).toEqual(['Colonia'])
  await act(async () => renderer.unmount())
})

test('drag capture stays on the viewport when markers disappear and clears after capture loss', async () => {
  const renderer = await renderWithAct(<GalacticAtlas bookmarks={[]} onNavigate={vi.fn()} onToggleBookmarks={vi.fn()} position={null} showBookmarks systemName={null} />)
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
  const renderer = await renderWithAct(<GalacticAtlas bookmarks={[]} onNavigate={vi.fn()} onToggleBookmarks={vi.fn()} position={null} showBookmarks systemName={null} />)
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
  const scale = pinched.match(/matrix\(([^ ]+)/)![1]
  await act(async () => viewport().props.onPointerUp(event(2, 200)))
  await act(async () => viewport().props.onPointerMove(event(1, 60)))
  expect(transform()).not.toBe(pinched)
  expect(transform()).toContain(`matrix(${scale} `)
  await act(async () => viewport().props.onPointerCancel(event(1, 60)))
  await act(async () => viewport().props.onPointerDown(event(3, 100)))
  await act(async () => viewport().props.onPointerMove(event(3, 130)))
  expect(transform()).toContain(`matrix(${scale} `)
  const keyboardClick = { detail: 0, preventDefault: vi.fn(), stopPropagation: vi.fn() }
  viewport().props.onClickCapture(keyboardClick)
  expect(keyboardClick.stopPropagation).not.toHaveBeenCalled()
  await act(async () => renderer.unmount())
})

test('bookmarks deduplicate system lookups, preserve station/body targets and report missing coordinates', async () => {
  const bookmark = (id: string, target: object) => ({ id, target, tags: [], note: null, createdAt: '', updatedAt: '' })
  const api = {
    getCommunityGoals: vi.fn().mockResolvedValue({ goals: [], fetchedAt: '2026-10-07T12:00:00Z', cache: 'fresh' }),
    getGalnetInvestigationLeads: vi.fn().mockResolvedValue({ leads: [], reportLimit: 20,
      omitted: { legacyReports: 0, changedReports: 0, endedLeads: 0, withoutDestination: 0 } }),
    getAtlasCatalogue: vi.fn().mockResolvedValue({ pois: [], sources: [] }),
    getGalaxyBookmarks: vi.fn().mockResolvedValue({ bookmarks: [
      bookmark('station', { kind: 'station', systemName: 'Example', stationName: 'Test Port' }),
      bookmark('body', { kind: 'body', systemName: 'Example', bodyName: 'Example 2' }),
      bookmark('missing', { kind: 'system', systemName: 'Unresolved' }),
      bookmark('unknown', { kind: 'system', systemName: 'Unknown coordinates' })
    ] }),
    getSystemCartography: vi.fn(async (name: string) => {
      if (name === 'Unresolved') throw new Error('Offline')
      if (name === 'Unknown coordinates') return { system: { position: null } }
      return { system: { position: [18000, 50, 40000] } }
    })
  } as unknown as PhoenixApi
  const onNavigate = vi.fn()
  const renderer = await renderWithAct(<GalacticAtlasPage api={api} onNavigate={onNavigate} runtime={{ status: 'ready', state: createEmptyRuntimeState() }} />)
  expect(api.getSystemCartography).toHaveBeenCalledTimes(3)
  expect(JSON.stringify(renderer.toJSON())).toContain('Bookmark lookup failed')
  expect(JSON.stringify(renderer.toJSON())).toContain('Unresolved: Offline')
  expect(JSON.stringify(renderer.toJSON())).toContain('1 bookmark without coordinates: Unknown coordinates')
  await act(async () => renderer.root.findAllByProps({ role: 'button' }).find(node => node.props['aria-label'] === '2 locations near Test Port')!.props.onClick())
  const groupSelect = renderer.root.findByProps({ 'aria-label': 'Locations in this group' })
  await act(async () => groupSelect.props.onChange({ target: { value: 'body' } }))
  expect(groupSelect.props.className).toContain('form-mini')
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Selected atlas location' }).findByType('a').props.onClick({ button: 0, preventDefault() {} }))
  expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ systemName: 'Example', selectedName: 'Example 2' }))
  await act(async () => renderer.unmount())
})
