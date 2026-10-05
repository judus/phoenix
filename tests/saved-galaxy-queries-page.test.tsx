import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { SavedGalaxyQuery } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { SavedGalaxyQueriesPage } from '../apps/web/src/features/galaxy/saved-galaxy-queries-page.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test.each([false, true])('explicit predefined import updates the list or exposes its error (%s)', async fail => {
  const query: SavedGalaxyQuery = { schemaVersion: 2, id: 'predefined', name: 'Pre-Odyssey Stratum candidates', queryId: 'exploration-targets', parameters: { origin: '', originMode: 'current' }, useOnDashboard: false, createdAt: '', updatedAt: '' }
  const importPredefinedGalaxyQueries = fail ? vi.fn().mockRejectedValue(new Error('Import unavailable')) : vi.fn().mockResolvedValue({ queries: [query] })
  const api = { getSavedGalaxyQueries: vi.fn().mockResolvedValue({ queries: [] }), importPredefinedGalaxyQueries } as unknown as PhoenixApi
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(<SavedGalaxyQueriesPage api={api} onNavigate={vi.fn()} />) })
  try {
    const button = renderer.root.findAllByType('button').find(button => button.children.includes('Add predefined queries'))!
    expect(button.props.disabled).toBe(false)
    await act(async () => button.props.onClick())
    expect(importPredefinedGalaxyQueries).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(renderer.toJSON())).toContain(fail ? 'Import unavailable' : query.name)
    expect(JSON.stringify(renderer.toJSON())).toContain(fail ? 'No saved queries.' : 'Current system (dynamic)')
  } finally { await act(async () => renderer.unmount()) }
})

test('saved-query text and type filters combine without modifying saved parameters', async () => {
  const queries: SavedGalaxyQuery[] = [
    { schemaVersion: 2, id: 'raw', name: 'Raw trader', queryId: 'facilities', parameters: { origin: 'Sol', service: 'material-trader-raw' }, useOnDashboard: false, createdAt: '', updatedAt: '' },
    { schemaVersion: 2, id: 'cargo', name: 'Cargo', queryId: 'commodity-markets', parameters: { origin: 'Sol', commodity: 'ModularTerminals' }, useOnDashboard: false, createdAt: '', updatedAt: '' }
  ]
  const original = structuredClone(queries)
  const onNavigate = vi.fn()
  const api = { getSavedGalaxyQueries: vi.fn().mockResolvedValue({ queries }) } as unknown as PhoenixApi
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<SavedGalaxyQueriesPage api={api} onNavigate={onNavigate} />) })
  try {
    const search = () => renderer.root.findByType('input')
    const type = () => renderer.root.findByType('select')
    const rows = () => renderer.root.findAllByType('tbody')[0]!.findAllByType('tr')
    await act(async () => search().props.onChange({ target: { value: ' SOL ' } }))
    expect(rows()).toHaveLength(2)
    await act(async () => type().props.onChange({ target: { value: 'facilities' } }))
    expect(rows()).toHaveLength(1)
    const run = renderer.root.findAllByType('button').find(button => button.children.includes('Run'))!
    await act(async () => run.props.onClick())
    expect(onNavigate).toHaveBeenLastCalledWith(expect.objectContaining({ savedQueryId: 'raw', selectedQueryId: 'facilities' }))
    await act(async () => search().props.onChange({ target: { value: 'modularterminals' } }))
    expect(JSON.stringify(renderer.toJSON())).toContain('No matching saved queries.')
    await act(async () => type().props.onChange({ target: { value: '' } }))
    expect(rows()).toHaveLength(1)
    expect(queries).toEqual(original)
  } finally { await act(async () => renderer.unmount()) }
})
