import { act, create } from 'react-test-renderer'
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest'
import { matchCatalogueSuggestions } from '@phoenix/elite'
import { SpanshSearchClient } from '../apps/server/src/infrastructure/spansh-search-client.js'
import { SpanshOutfittingSearchSource } from '../apps/server/src/infrastructure/spansh-outfitting-search-source.js'
import { CatalogueSuggestionInput } from '../apps/web/src/features/galaxy/catalogue-suggestion-input.js'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'

const names = ['Point Defence', 'Guardian FSD Booster', 'Mk II Gravity Optimised Thrusters', 'Mk II Agile Boost Thrusters']
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function moduleSuggestions(names: string[], query: string) {
  return matchCatalogueSuggestions(names.map(name => ({ label: name, value: name, source: 'Spansh' as const })), 'module', query).map(item => item.value)
}

test('partial module names and familiar spellings resolve to provider names without losing class/rating', () => {
  expect(moduleSuggestions(names, 'point defense turret')).toEqual(['Point Defence'])
  expect(moduleSuggestions(names, '5h guardian booster')).toEqual(['5H Guardian FSD Booster'])
  expect(moduleSuggestions(names, 'mkii optimized')).toEqual(['Mk II Gravity Optimised Thrusters'])
  expect(moduleSuggestions(names, 'frame shift drive')).toEqual(['Guardian FSD Booster'])
  expect(moduleSuggestions(names, 'thrusters')).toHaveLength(2)
  expect(moduleSuggestions(names, '')).toEqual([])
  expect(moduleSuggestions(names, 'unknown')).toEqual([])
})

test('Spansh parses composite module values and caches concurrent catalogue lookups', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ values: { name: [...names, names[0]], class: ['0'] } })))
  const source = new SpanshOutfittingSearchSource(new SpanshSearchClient({ fetch: fetcher }))
  expect(await Promise.all([source.moduleNames(), source.moduleNames()])).toEqual([names, names])
  expect(fetcher).toHaveBeenCalledTimes(1)
})

test('a failed catalogue fetch is retryable rather than cached', async () => {
  const findFieldValues = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(names)
  const source = new SpanshOutfittingSearchSource({ findFieldValues, search: async () => [] })
  await expect(source.moduleNames()).rejects.toThrow('offline')
  await expect(source.moduleNames()).resolves.toEqual(names)
  expect(findFieldValues).toHaveBeenCalledTimes(2)
})

test('module suggestion buttons select the canonical name and never submit the form', async () => {
  const onChange = vi.fn()
  const api = { getCatalogueSuggestions: vi.fn().mockResolvedValue([{ label: 'Point Defence', value: 'Point Defence', source: 'Spansh' }]) } as unknown as PhoenixApi
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<CatalogueSuggestionInput api={api} kind="module" label="Module" value="point defense" onChange={onChange} />) })
  await act(async () => renderer.root.findAllByType('div').find(node => node.props.onFocus)!.props.onFocus())
  await act(async () => { await vi.advanceTimersByTimeAsync(151) })
  const button = renderer.root.findByType('button')
  expect(button.props.type).toBe('button')
  expect(button.props.children).toBe('Point Defence')
  await act(async () => button.props.onClick())
  expect(onChange).toHaveBeenCalledWith('Point Defence')
  await act(async () => renderer.unmount())
})

test('catalogue failure leaves manual entry available with an honest message', async () => {
  const api = { getCatalogueSuggestions: vi.fn().mockRejectedValue(new Error('offline')) } as unknown as PhoenixApi
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<CatalogueSuggestionInput api={api} kind="module" label="Module" value="Point Defence" onChange={vi.fn()} />) })
  await act(async () => renderer.root.findAllByType('div').find(node => node.props.onFocus)!.props.onFocus())
  await act(async () => { await vi.advanceTimersByTimeAsync(151) })
  expect(JSON.stringify(renderer.toJSON())).toContain('Suggestions unavailable')
  expect(renderer.root.findByType('input').props.disabled).not.toBe(true)
  await act(async () => renderer.unmount())
})

test.each(['ship', 'commodity'] as const)('%s suggestions support arrows, Enter and Escape without submitting the form', async kind => {
  const onChange = vi.fn()
  const api = { getCatalogueSuggestions: vi.fn().mockResolvedValue([{ label: 'Gold', value: 'gold', source: 'Elite' }]) } as unknown as PhoenixApi
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<CatalogueSuggestionInput api={api} kind={kind} label="Name" value="go" onChange={onChange} />) })
  await act(async () => renderer.root.findAllByType('div').find(node => node.props.onFocus)!.props.onFocus())
  await act(async () => { await vi.advanceTimersByTimeAsync(151) })
  const preventDefault = vi.fn()
  const press = (key: string) => act(async () => renderer.root.findByType('input').props.onKeyDown({ key, nativeEvent: {}, preventDefault, stopPropagation: vi.fn() }))
  await press('ArrowDown')
  expect(renderer.root.findByType('input').props['aria-activedescendant']).toContain('option-0')
  await press('Enter')
  expect(onChange).toHaveBeenCalledWith('gold')
  expect(preventDefault).toHaveBeenCalledTimes(2)
  expect(renderer.root.findByType('input').props['aria-expanded']).toBe(false)
  await press('ArrowDown')
  await press('Escape')
  expect(renderer.root.findByType('input').props['aria-expanded']).toBe(false)
  await act(async () => renderer.unmount())
})

test('superseded requests are aborted and cannot replace newer results', async () => {
  let resolveOld!: (items: unknown[]) => void
  const getCatalogueSuggestions = vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    .mockResolvedValue([{ label: 'Silver', value: 'silver', source: 'Elite' }])
  const api = { getCatalogueSuggestions } as unknown as PhoenixApi
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<CatalogueSuggestionInput api={api} kind="commodity" label="Commodity" value="go" onChange={vi.fn()} />) })
  await act(async () => renderer.root.findAllByType('div').find(node => node.props.onFocus)!.props.onFocus())
  await act(async () => { await vi.advanceTimersByTimeAsync(151) })
  await act(async () => renderer.update(<CatalogueSuggestionInput api={api} kind="commodity" label="Commodity" value="sil" onChange={vi.fn()} />))
  expect(getCatalogueSuggestions.mock.calls[0]![2].aborted).toBe(true)
  await act(async () => { await vi.advanceTimersByTimeAsync(151) })
  await act(async () => resolveOld([{ label: 'Gold', value: 'gold', source: 'Elite' }]))
  expect(renderer.root.findByType('button').props.children).toBe('Silver')
  await act(async () => renderer.unmount())
})
