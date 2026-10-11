import { act } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import { GalaxyQueryAtlas, queryAtlasCamera } from '../apps/web/src/features/galaxy/galaxy-query-atlas.js'
import { galaxyQueryLocations, type GalaxyQueryResult } from '../apps/web/src/features/galaxy/galaxy-query-results.js'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { renderWithAct } from './support/render-with-act.js'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { GalaxyPage } from '../apps/web/src/features/galaxy/galaxy-page.js'
import { GalaxyQuerySessionStore } from '../apps/web/src/features/galaxy/galaxy-query-session-store.js'
import { BrowserDevicePreferences } from '../apps/web/src/platform/storage/browser-device-preferences.js'
import { PageHeader } from '@phoenix/ui'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

const station = (systemName: string, stationName = 'Port') => ({ systemName, stationName, distanceLy: 10, distanceToArrivalLs: 100,
  allegiance: null, controllingFaction: null, government: null, primaryEconomy: null, secondaryEconomy: null,
  marketId: null, maxLandingPadSize: 3, stationType: 'Coriolis Starport', updatedAt: null })
const facilities: Extract<GalaxyQueryResult, { id: 'facilities' }> = { id: 'facilities', value: { cache: 'fresh', originSystem: 'Sol', minimumPadSize: null, service: 'refuel', stations: [station('Nearby', 'First'), station('Nearby', 'Second'), station('Unknown'), station('Failed')] } }

function atlasLayers() {
  return {
    getGalaxyBookmarks: vi.fn(async () => ({ bookmarks: [] })),
    getAtlasCatalogue: vi.fn(async () => ({ pois: [] })),
    getCommunityGoals: vi.fn(async () => ({ goals: [], cache: 'fresh' })),
    getGalnetInvestigationLeads: vi.fn(async () => ({ leads: [] }))
  }
}

test('result locations retain separate station identities and trade endpoints', () => {
  const locations = galaxyQueryLocations(facilities)
  expect(locations.map(location => location.marker.id)).toEqual(['query:0', 'query:1', 'query:2', 'query:3'])
  expect(locations[1]!.marker).toMatchObject({ label: 'Second', selectedName: 'Second', bookmarkTarget: { kind: 'station', systemName: 'Nearby', stationName: 'Second' } })
  const market = { ...station('Buy'), commodityName: 'Gold', commoditySymbol: 'gold', buyPrice: 50, sellPrice: 100, demand: 100, stock: 100, meanPrice: 80 }
  const trade: GalaxyQueryResult = { id: 'trade-opportunities', value: { cache: 'fresh', candidateCommoditiesChecked: 1, exportCommoditiesFound: 1, caveat: 'Synthetic', originSystem: 'Sol', opportunities: [{ buyMarket: market, sellMarket: { ...market, systemName: 'Sell' }, commodityName: 'Gold', commoditySymbol: 'gold', projectedProfit: 500, travelDistanceLy: 10, unitMargin: 50, units: 10 }] } }
  const endpoints = galaxyQueryLocations(trade)
  expect(endpoints.map(location => location.marker.systemName)).toEqual(['Buy', 'Sell'])
  expect(endpoints[0]!.marker.label).toBe('Buy Gold · Port')
  expect(endpoints[1]!.marker.id).not.toBe(endpoints[0]!.marker.id)
})

test('coordinates are deduplicated, unlocated results are reported and selected details retain table fields', async () => {
  const api = { ...atlasLayers(), getSystemCartography: vi.fn(async (system: string) => {
    if (system === 'Failed') throw new Error('Provider unavailable')
    return { system: { position: system === 'Nearby' ? [20, 5, 0] : null } }
  }) } as unknown as PhoenixApi
  const renderer = await renderWithAct(<GalaxyQueryAtlas api={api} result={facilities} position={[0, 0, 0]} systemName="Sol" navigationRoute={{ timestamp: null, route: [] }} onNavigate={vi.fn()} />)
  expect(api.getSystemCartography).toHaveBeenCalledTimes(3)
  const text = JSON.stringify(renderer.toJSON())
  expect(text).toContain('2 / 4 result locations')
  expect(text).toContain('1 system without coordinates')
  expect(text).toContain('1 coordinate lookup failed')
  expect(renderer.root.findAllByType('h1')).toHaveLength(0)
  const group = renderer.root.findAllByProps({ role: 'button' }).find(node => String(node.props['aria-label']).includes('First'))!
  await act(async () => group.props.onClick())
  const select = renderer.root.findByProps({ 'aria-label': 'Locations in this group' })
  await act(async () => select.props.onChange({ target: { value: 'query:1' } }))
  expect(JSON.stringify(renderer.toJSON())).toContain('Second')
  expect(renderer.root.findByType('aside').findAllByType('dt').map(node => node.children.join(''))).toContain('Arrival')
  await act(async () => renderer.unmount())
})

test('known coordinates avoid provider requests, including the plotted route', async () => {
  const api = { ...atlasLayers(), getSystemCartography: vi.fn() } as unknown as PhoenixApi
  const result: GalaxyQueryResult = { ...facilities, value: { ...facilities.value, stations: [station('Sol'), station('Nearby')] } }
  const renderer = await renderWithAct(<GalaxyQueryAtlas api={api} result={result} position={[0, 0, 0]} systemName="Sol" navigationRoute={{ timestamp: null, route: [{ system: 'Nearby', address: 1, starClass: 'G', position: [30, 0, 0] }] }} onNavigate={vi.fn()} />)
  expect(api.getSystemCartography).not.toHaveBeenCalled()
  expect(JSON.stringify(renderer.toJSON())).toContain('2 / 2 result locations')
  await act(async () => renderer.unmount())
})

test('unmount aborts coordinate work before it can publish stale results', async () => {
  let resolve!: (value: unknown) => void
  let signal!: AbortSignal
  const api = { ...atlasLayers(), getSystemCartography: vi.fn((_name: string, requestSignal: AbortSignal) => { signal = requestSignal; return new Promise(done => { resolve = done }) }) } as unknown as PhoenixApi
  const result: GalaxyQueryResult = { ...facilities, value: { ...facilities.value, stations: [station('Pending')] } }
  const renderer = await renderWithAct(<GalaxyQueryAtlas api={api} result={result} position={null} systemName={null} onNavigate={vi.fn()} />)
  expect(JSON.stringify(renderer.toJSON())).toContain('Locating 1 system')
  await act(async () => renderer.unmount())
  expect(signal.aborted).toBe(true)
  await act(async () => resolve({ system: { position: [0, 0, 0] } }))
})

test('query camera fits nearby results without zooming to the distant route destination', () => {
  expect(queryAtlasCamera([[100, 0, 0]], [0, 0, 0]).zoom).toBeGreaterThan(100)
  expect(queryAtlasCamera([], null).zoom).toBe(1)
})

test('saved-query execution respects the persisted Atlas view; toggling does not rerun the search', async () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  new BrowserDevicePreferences(storage).update({ galaxyQueryResultsView: 'atlas' })
  const preferences = new BrowserDevicePreferences(storage)
  const saved = { id: '00000000-0000-4000-8000-000000000001', name: 'Next refuel', queryId: 'facilities' as const,
    schemaVersion: 2 as const, parameters: { originMode: 'current', service: 'refuel', pad: 'large' }, useOnDashboard: false,
    createdAt: '2026-10-10T12:00:00Z', updatedAt: '2026-10-10T12:00:00Z' }
  const api = { ...atlasLayers(), getSavedGalaxyQueries: vi.fn(async () => ({ queries: [saved] })),
    findGalaxyNearestStations: vi.fn(async () => ({ ...facilities.value, stations: [station('Sol')] })) } as unknown as PhoenixApi
  const state = createEmptyRuntimeState()
  state.system = { ...state.system, name: 'Sol', position: [0, 0, 0] }
  const renderer = await renderWithAct(<GalaxyPage devicePreferences={preferences} api={api} controller={{ status: 'ready', route: { timestamp: null, route: [] } }}
    querySessions={new GalaxyQuerySessionStore()} onNavigate={vi.fn()} runtime={{ state, status: 'ready' }}
    route={{ kind: 'information', section: 'galaxy', view: 'database', selectedQueryId: 'facilities', savedQueryId: saved.id, savedQueryRunId: 'run' }} />)
  // Flush the lazy map import using the same module as the direct Atlas tests.
  await act(async () => { await import('../apps/web/src/features/galaxy/galaxy-query-atlas.js') })
  expect(renderer.root.findByProps({ 'aria-label': 'Show table view' })).toBeDefined()
  const header = renderer.root.findByType(PageHeader)
  expect(header.props.status).toBeUndefined()
  expect(header.findAllByType('button').map(button => button.props['aria-label'] ?? button.props.children)).toEqual([
    'Regions', 'Bookmarks', 'Plotted route', 'Community Goal destinations', 'GalNet investigation destinations', 'Landmarks', 'Finder', 'Show table view', 'Change query', 'Update saved query'
  ])
  expect(renderer.root.findByProps({ className: 'atlas-telemetry' }).findAllByType('a').some(link => link.props.children === 'Sol')).toBe(true)
  expect(renderer.root.findAllByType('h2').filter(node => node.props.children === 'Query results')).toHaveLength(0)
  expect(header.findByProps({ 'aria-label': 'Plotted route' }).props.pressed).toBe(true)
  await act(async () => header.findByProps({ 'aria-label': 'Plotted route' }).props.onClick())
  expect(header.findByProps({ 'aria-label': 'Plotted route' }).props.pressed).toBe(false)
  const regions = header.findAllByType('button').find(button => button.props['aria-label'] === 'Regions')!
  expect(regions.props['aria-pressed']).toBe(true)
  await act(async () => regions.props.onClick())
  expect(header.findAllByType('button').find(button => button.props['aria-label'] === 'Regions')!.props['aria-pressed']).toBe(false)
  expect(renderer.root.findAllByProps({ className: 'atlas-region-label active' })).toHaveLength(0)
  expect(renderer.root.findAllByProps({ className: 'query-result-atlas' })).toHaveLength(1)
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Show table view' }).props.onClick())
  expect(preferences.getSnapshot().galaxyQueryResultsView).toBe('table')
  expect(renderer.root.findAllByType('table')).toHaveLength(1)
  expect(renderer.root.findAllByType('h2').filter(node => node.props.children === 'Query results')).toHaveLength(1)
  expect(renderer.root.findByType(PageHeader).props.status).toBeUndefined()
  for (const label of ['Change query', 'Update saved query']) {
    expect(renderer.root.findByType(PageHeader).findAllByType('button').find(button => button.props['aria-label'] === label)!.props.className).toContain('btn-icon-square')
  }
  expect(renderer.root.findAllByProps({ className: 'query-result-actions' })).toHaveLength(0)
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Show atlas view' }).props.onClick())
  expect(renderer.root.findByType(PageHeader).findByProps({ 'aria-label': 'Plotted route' }).props.pressed).toBe(true)
  expect(new BrowserDevicePreferences(storage).getSnapshot().galaxyQueryResultsView).toBe('atlas')
  expect(api.findGalaxyNearestStations).toHaveBeenCalledTimes(1)
  await act(async () => renderer.root.findByType(PageHeader).findByProps({ 'aria-label': 'Update saved query' }).props.onClick())
  expect(renderer.root.findByProps({ id: 'saved-query-name' }).props.value).toBe('Next refuel')
  const panel = renderer.root.findByProps({ className: 'save-query-panel' })
  const editor = renderer.root.findByProps({ className: 'galaxy-query-editor save-open' })
  expect(editor.findAll(node => node.type === 'section' && ['save-query-panel', 'query-results atlas'].includes(node.props.className)).map(node => node.props.className)).toEqual(['save-query-panel', 'query-results atlas'])
  expect(renderer.root.findByProps({ className: 'query-results atlas' }).findAllByProps({ className: 'save-query-panel' })).toHaveLength(0)
  expect(panel.findAllByType('button').find(button => button.props['aria-label'] === 'Cancel')!.props.className).toContain('btn-icon-square')
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Show table view' }).props.onClick())
  expect(renderer.root.findByProps({ className: 'galaxy-query-editor save-open' }).findAll(node => typeof node.type === 'string' && /(?:^| )(save-query-panel|query-results)(?: |$)/.test(node.props.className ?? '')).map(node => node.props.className.includes('save-query-panel') ? 'save-query-panel' : 'query-results')).toEqual(['save-query-panel', 'query-results'])
  expect(renderer.root.findByProps({ id: 'saved-query-name' }).props.value).toBe('Next refuel')
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Show atlas view' }).props.onClick())
  await act(async () => renderer.root.findByProps({ className: 'save-query-panel' }).findByProps({ 'aria-label': 'Cancel' }).props.onClick())
  expect(renderer.root.findAllByProps({ className: 'save-query-panel' })).toHaveLength(0)
  await act(async () => renderer.root.findByType(PageHeader).findByProps({ 'aria-label': 'Change query' }).props.onClick())
  expect(renderer.root.findAllByType('form')).toHaveLength(1)
  expect(renderer.root.findAllByType('select').some(select => select.props.value === 'refuel')).toBe(true)
  expect(renderer.root.findAllByType('select').some(select => select.props.value === 'large')).toBe(true)
  expect(api.findGalaxyNearestStations).toHaveBeenCalledTimes(1)
  await act(async () => renderer.unmount())
})

test('embedded Atlas uses shared bookmark, Community Goal and lead layers and Finder', async () => {
  const api = {
    ...atlasLayers(),
    getGalaxyBookmarks: vi.fn(async () => ({ bookmarks: [{ id: 'bookmark', target: { kind: 'system', systemName: 'Bookmarked' } }] })),
    getCommunityGoals: vi.fn(async () => ({ goals: [{ id: 'cg', title: 'Supplies', systemName: 'Campaign', stationName: 'Port' }], cache: 'fresh' })),
    getGalnetInvestigationLeads: vi.fn(async () => ({ leads: [{ id: 'lead', title: 'Beacon', systemName: 'Investigation' }] })),
    getSystemCartography: vi.fn(async (name: string) => ({ system: { name, position: [name === 'Bookmarked' ? 20 : name === 'Campaign' ? 40 : 60, 0, 0] } }))
  } as unknown as PhoenixApi
  const renderer = await renderWithAct(<GalaxyQueryAtlas api={api} result={{ ...facilities, value: { ...facilities.value, stations: [station('Sol')] } }}
    position={[0, 0, 0]} systemName="Sol" onNavigate={vi.fn()} />)
  try {
    const markers = () => renderer.root.findAllByProps({ role: 'button' }).map(node => node.props['aria-label'])
    expect(markers()).toEqual(expect.arrayContaining(['Bookmarked', 'CG · Supplies', 'Lead · Beacon']))
    const buttons = () => renderer.root.findAllByType('button')
    await act(async () => buttons().find(button => button.props['aria-label'] === 'Bookmarks')!.props.onClick())
    expect(markers()).not.toContain('Bookmarked')
    expect(markers()).toContain('CG · Supplies')
    await act(async () => buttons().find(button => button.props['aria-label'] === 'Finder')!.props.onClick())
    expect(renderer.root.findAllByType('aside')).toHaveLength(1)
    expect(buttons().some(button => button.props.children === 'Clear')).toBe(true)
    expect(renderer.root.findByProps({ className: 'atlas-telemetry' })).toBeDefined()
    expect(api.getAtlasCatalogue).toHaveBeenCalledTimes(1)
    expect(api.getCommunityGoals).toHaveBeenCalledTimes(1)
    expect(api.getGalnetInvestigationLeads).toHaveBeenCalledTimes(1)
  } finally { await act(async () => renderer.unmount()) }
})

test('empty results are a normal Atlas state and do not trigger coordinate lookups', async () => {
  const api = { ...atlasLayers(), getSystemCartography: vi.fn() } as unknown as PhoenixApi
  const renderer = await renderWithAct(<GalaxyQueryAtlas api={api} result={{ ...facilities, value: { ...facilities.value, stations: [] } }} position={null} systemName={null} onNavigate={vi.fn()} />)
  expect(JSON.stringify(renderer.toJSON())).toContain('No matching results.')
  expect(api.getSystemCartography).not.toHaveBeenCalled()
  await act(async () => renderer.unmount())
})

test.each([false, true])('coordinate loading is bounded and final fitting respects camera interaction (%s)', async touchCamera => {
  const pending = new Map<string, (value: unknown) => void>()
  const api = { ...atlasLayers(), getSystemCartography: vi.fn((system: string) => new Promise(resolve => pending.set(system, resolve))) } as unknown as PhoenixApi
  const result: GalaxyQueryResult = { ...facilities, value: { ...facilities.value, stations: ['A', 'B', 'C'].map(name => station(name)) } }
  const renderer = await renderWithAct(<GalaxyQueryAtlas api={api} result={result} position={[0, 0, 0]} systemName="Sol" onNavigate={vi.fn()} />)
  expect(api.getSystemCartography).toHaveBeenCalledTimes(2)
  const plane = () => renderer.root.findByProps({ className: 'atlas-plane' }).props.transform
  if (touchCamera) await act(async () => renderer.root.findByProps({ 'aria-label': 'Zoom in' }).props.onClick())
  const before = plane()
  await act(async () => pending.get('A')!({ system: { position: [20, 0, 0] } }))
  expect(api.getSystemCartography).toHaveBeenCalledTimes(3)
  expect(JSON.stringify(renderer.toJSON())).toContain('1 / 3 result locations')
  await act(async () => { pending.get('B')!({ system: { position: [30, 0, 0] } }); pending.get('C')!({ system: { position: [40, 0, 0] } }) })
  expect(JSON.stringify(renderer.toJSON())).toContain('3 / 3 result locations')
  if (touchCamera) expect(plane()).toBe(before)
  else expect(plane()).not.toBe(before)
  await act(async () => renderer.unmount())
})
