import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { useEngineeringController, type EngineeringControllerSnapshot, type EngineeringView } from '../apps/web/src/features/engineering/use-engineering-controller.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('Engineering selects one focused API query for each view', async () => {
  const api = {
    getEngineeringBlueprints: vi.fn().mockResolvedValue({ blueprints: [] }),
    getEngineeringBlueprint: vi.fn().mockResolvedValue({ name: 'Dirty drive tuning' }),
    getEngineeringEngineers: vi.fn().mockResolvedValue({ engineers: [] }),
    getEngineeringMaterials: vi.fn().mockResolvedValue({ materials: [], updatedAt: null })
  } as unknown as PhoenixApi
  let snapshot: EngineeringControllerSnapshot | undefined
  let view: EngineeringView = 'blueprints'
  let symbol: string | undefined

  function Probe() { snapshot = useEngineeringController(api, view, symbol, 1); return null }
  const renderer = await act(async () => create(<Probe />))
  expect(api.getEngineeringBlueprints).toHaveBeenCalledTimes(1)
  expect(snapshot).toMatchObject({ blueprints: { blueprints: [] }, status: 'ready' })

  symbol = 'dirty-drive-tuning'
  await act(async () => renderer.update(<Probe />))
  expect(api.getEngineeringBlueprint).toHaveBeenCalledWith('dirty-drive-tuning', expect.any(AbortSignal))

  symbol = undefined
  view = 'materials-encoded'
  await act(async () => renderer.update(<Probe />))
  expect(api.getEngineeringMaterials).toHaveBeenCalledWith('encoded', expect.any(AbortSignal))

  view = 'engineers'
  await act(async () => renderer.update(<Probe />))
  expect(api.getEngineeringEngineers).toHaveBeenCalledWith(expect.any(AbortSignal))
  await act(async () => renderer.unmount())
})

test('Engineering retains a successful page snapshot while a revisit refreshes', async () => {
  const blueprints = { blueprints: [{ name: 'Dirty drive tuning', symbol: 'dirty-drive-tuning' }] }
  const api = {
    getEngineeringBlueprints: vi.fn().mockResolvedValue(blueprints)
  } as unknown as PhoenixApi
  let snapshot: EngineeringControllerSnapshot | undefined

  function Probe() { snapshot = useEngineeringController(api, 'blueprints'); return null }
  let renderer = await act(async () => create(<Probe />))
  expect(snapshot).toMatchObject({ blueprints, status: 'ready' })
  await act(async () => renderer.unmount())

  vi.mocked(api.getEngineeringBlueprints).mockImplementationOnce(() => new Promise(() => undefined))
  renderer = await act(async () => create(<Probe />))

  expect(api.getEngineeringBlueprints).toHaveBeenCalledTimes(2)
  expect(snapshot).toMatchObject({ blueprints, status: 'ready' })
  await act(async () => renderer.unmount())
})
