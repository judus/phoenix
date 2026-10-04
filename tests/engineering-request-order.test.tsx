import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { useEngineeringController, type EngineeringControllerSnapshot, type EngineeringRoute } from '../apps/web/src/features/engineering/use-engineering-controller.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

const routes: EngineeringRoute[] = [
  { kind: 'information', section: 'engineering', view: 'projects' },
  { kind: 'information', section: 'engineering', view: 'project-detail', selectedProjectId: 'one' },
  { kind: 'information', section: 'engineering', view: 'experimental-effects' },
  { kind: 'information', section: 'engineering', view: 'project-add-blueprint', selectedBlueprintSymbol: 'dirty-drive' }
]

test.each(routes)('Engineering starts projects before the secondary request for $view', async route => {
  const calls: string[] = []
  const api = {
    getEngineeringProjects: () => { calls.push('projects'); return Promise.resolve({ schemaVersion: 1, projects: [] }) },
    getEngineeringMaterialWatchlist: () => { calls.push('watchlist'); return Promise.resolve({ materials: [] }) },
    getEngineeringExperimentalEffects: () => { calls.push('effects'); return Promise.resolve({ effects: [] }) },
    getEngineeringBlueprint: (symbol: string) => { calls.push(`blueprint:${symbol}`); return Promise.resolve({ symbol }) }
  } as unknown as PhoenixApi
  function Probe() { useEngineeringController(api, route); return null }
  const renderer = await act(async () => create(<Probe />))
  expect(calls).toEqual(['projects', route.view === 'experimental-effects' ? 'effects' : route.view === 'project-add-blueprint' ? 'blueprint:dirty-drive' : 'watchlist'])
  await act(async () => renderer.unmount())
})

test.each(['projects', 'secondary'])('synchronous %s API throws retain effect-error propagation', async failing => {
  const calls: string[] = []
  const error = new Error('Synchronous failure')
  const api = {
    getEngineeringProjects: () => {
      calls.push('projects')
      if (failing === 'projects') throw error
      return Promise.resolve({ schemaVersion: 1, projects: [] })
    },
    getEngineeringMaterialWatchlist: () => { calls.push('watchlist'); throw error }
  } as unknown as PhoenixApi
  function Probe() { useEngineeringController(api, routes[0]!); return null }
  await expect(act(async () => { create(<Probe />) })).rejects.toBe(error)
  expect(calls).toEqual(failing === 'projects' ? ['projects'] : ['projects', 'watchlist'])
})

test('a rejected API promise still enters controller error state', async () => {
  let snapshot: EngineeringControllerSnapshot | undefined
  const api = {
    getEngineeringProjects: vi.fn().mockRejectedValue(new Error('Rejected failure')),
    getEngineeringMaterialWatchlist: vi.fn().mockResolvedValue({ materials: [] })
  } as unknown as PhoenixApi
  function Probe() { snapshot = useEngineeringController(api, routes[0]!); return null }
  const renderer = await act(async () => create(<Probe />))
  expect(snapshot).toMatchObject({ error: 'Rejected failure', status: 'error' })
  await act(async () => renderer.unmount())
})
