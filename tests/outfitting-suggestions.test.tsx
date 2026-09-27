import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import { SpanshSearchClient } from '../apps/server/src/infrastructure/spansh-search-client.js'
import { SpanshOutfittingSearchSource } from '../apps/server/src/infrastructure/spansh-outfitting-search-source.js'
import { moduleSuggestions, OutfittingModuleInput } from '../apps/web/src/features/galaxy/outfitting-module-input.js'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'

const names = ['Point Defence', 'Guardian FSD Booster', 'Mk II Gravity Optimised Thrusters', 'Mk II Agile Boost Thrusters']
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

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
  const api = { getOutfittingModuleNames: vi.fn().mockResolvedValue(names) } as unknown as PhoenixApi
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<OutfittingModuleInput api={api} value="point defense" onChange={onChange} />) })
  await act(async () => renderer.root.findAllByType('div').find(node => node.props.onFocus)!.props.onFocus())
  const button = renderer.root.findByType('button')
  expect(button.props.type).toBe('button')
  expect(button.props.children).toBe('Point Defence')
  await act(async () => button.props.onClick())
  expect(onChange).toHaveBeenCalledWith('Point Defence')
  await act(async () => renderer.unmount())
})

test('catalogue failure leaves manual entry available with an honest message', async () => {
  const api = { getOutfittingModuleNames: vi.fn().mockRejectedValue(new Error('offline')) } as unknown as PhoenixApi
  let renderer: ReturnType<typeof create>
  await act(async () => { renderer = create(<OutfittingModuleInput api={api} value="Point Defence" onChange={vi.fn()} />) })
  expect(JSON.stringify(renderer.toJSON())).toContain('Suggestions unavailable')
  expect(renderer.root.findByType('input').props.disabled).not.toBe(true)
  await act(async () => renderer.unmount())
})
