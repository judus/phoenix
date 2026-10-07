import { act } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { CommunityGoal, CommunityGoalsResponse } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { useAtlasCommunityGoals } from '../apps/web/src/features/galaxy/use-atlas-community-goals.js'
import { GalacticAtlas } from '../apps/web/src/features/galaxy/galactic-atlas-page.js'
import { renderWithAct } from './support/render-with-act.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

const goal = (id: string, systemName = 'Synthetic'): CommunityGoal => ({
  id, title: `Campaign ${id}`, systemName, stationName: 'Research Port', activityType: 'trade',
  objective: 'Deliver supplies', targetCommodities: 'Basic Medicines', contributed: 125, target: 1000,
  expiry: '2026-10-08 10:00:00', briefing: 'Synthetic official briefing.'
})
const snapshot = (goals: CommunityGoal[], cache: CommunityGoalsResponse['cache'] = 'fresh'): CommunityGoalsResponse => ({
  goals, cache, fetchedAt: '2026-10-07T12:00:00Z'
})
type State = ReturnType<typeof useAtlasCommunityGoals>

test('CG destinations deduplicate systems, bound lookups and retain only resolved positions without losing other goals', async () => {
  const pending: Array<(position: [number, number, number] | null) => void> = []
  const getSystemCartography = vi.fn((_name: string) => new Promise(resolve => {
    pending.push(position => resolve({ system: { position } }))
  }))
  const api = { getCommunityGoals: vi.fn().mockResolvedValue(snapshot([
    goal('1'), goal('2', 'SYNTHETIC'), goal('3', 'Unknown'), goal('4', 'Offline')
  ])), getSystemCartography } as unknown as PhoenixApi
  let state: State | undefined
  function Probe() { state = useAtlasCommunityGoals(api, true); return null }
  const renderer = await renderWithAct(<Probe />)
  try {
    expect(state?.loading).toBe(true)
    expect(getSystemCartography).toHaveBeenCalledTimes(2)
    getSystemCartography.mockRejectedValueOnce(new Error('Offline'))
    await act(async () => { pending[0]!([18000, 20, 40000]); pending[1]!(null) })
    expect(getSystemCartography).toHaveBeenCalledTimes(3)
    expect(state?.unlocatedSystems.sort()).toEqual(['Offline', 'Unknown'])
    expect(state?.markers).toMatchObject([
      { id: 'community-goal:1', kind: 'community-goal', systemName: 'Synthetic', position: [18000, 20, 40000], selectedName: 'Research Port' },
      { id: 'community-goal:2', kind: 'community-goal', systemName: 'SYNTHETIC', position: [18000, 20, 40000] }
    ])
    expect(state?.loading).toBe(false)
  } finally { await act(async () => renderer.unmount()) }
})

test('CG refresh retains dated stale evidence, preserves a displayed snapshot on network failure and removes goals after authoritative empty', async () => {
  vi.useFakeTimers()
  const getCommunityGoals = vi.fn().mockResolvedValueOnce(snapshot([goal('1')], 'stale'))
  const api = { getCommunityGoals, getSystemCartography: vi.fn().mockResolvedValue({ system: { position: [1, 2, 3] } }) } as unknown as PhoenixApi
  let state: State | undefined
  function Probe() { state = useAtlasCommunityGoals(api, true); return null }
  const renderer = await renderWithAct(<Probe />)
  try {
    expect(state?.snapshot).toEqual(snapshot([goal('1')], 'stale'))
    getCommunityGoals.mockRejectedValueOnce(new Error('Network unavailable'))
    await act(async () => { vi.advanceTimersByTime(15 * 60 * 1000) })
    expect(getCommunityGoals).toHaveBeenCalledTimes(1)
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(state?.error).toBe('Network unavailable')
    expect(state?.markers).toHaveLength(1)
    expect(state?.snapshot?.fetchedAt).toBe('2026-10-07T12:00:00Z')
    getCommunityGoals.mockResolvedValueOnce(snapshot([]))
    await act(async () => { vi.advanceTimersByTime(15 * 60 * 1000 + 1000) })
    expect(state?.markers).toEqual([])
    expect(state?.snapshot?.goals).toEqual([])
    expect(state?.error).toBeUndefined()
    expect(api.getSystemCartography).toHaveBeenCalledTimes(1)
  } finally { await act(async () => renderer.unmount()); vi.useRealTimers() }
})

test('disabled layer does not read, and disabling during coordinate resolution cancels and ignores late results', async () => {
  vi.useFakeTimers()
  let finish: ((value: unknown) => void) | undefined
  const api = {
    getCommunityGoals: vi.fn().mockResolvedValue(snapshot([goal('1')])),
    getSystemCartography: vi.fn(() => new Promise(resolve => { finish = resolve }))
  } as unknown as PhoenixApi
  let state: State | undefined
  function Probe({ enabled }: { enabled: boolean }) { state = useAtlasCommunityGoals(api, enabled); return null }
  const renderer = await renderWithAct(<Probe enabled={false} />)
  try {
    expect(api.getCommunityGoals).not.toHaveBeenCalled()
    await act(async () => renderer.update(<Probe enabled />))
    const signal = vi.mocked(api.getCommunityGoals).mock.calls[0]![0]!
    expect(api.getSystemCartography).toHaveBeenCalledWith('Synthetic', signal)
    await act(async () => renderer.update(<Probe enabled={false} />))
    expect(signal.aborted).toBe(true)
    await act(async () => finish?.({ system: { position: [1, 2, 3] } }))
    expect(state?.markers).toEqual([])
    await act(async () => { vi.advanceTimersByTime(30 * 60 * 1000) })
    expect(api.getCommunityGoals).toHaveBeenCalledTimes(1)
  } finally { await act(async () => renderer.unmount()); vi.useRealTimers() }
})

test('cold failure is visible and unmount cancels a pending goal fetch without resolving destinations', async () => {
  const api = { getCommunityGoals: vi.fn().mockRejectedValueOnce(new Error('Frontier unavailable')),
    getSystemCartography: vi.fn() } as unknown as PhoenixApi
  let state: State | undefined
  function Probe() { state = useAtlasCommunityGoals(api, true); return null }
  const renderer = await renderWithAct(<Probe />)
  expect(state).toMatchObject({ error: 'Frontier unavailable', loading: false, markers: [] })
  await act(async () => renderer.unmount())
  let finish: ((value: CommunityGoalsResponse) => void) | undefined
  vi.mocked(api.getCommunityGoals).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = await renderWithAct(<Probe />)
  const signal = vi.mocked(api.getCommunityGoals).mock.calls[1]![0]!
  await act(async () => pending.unmount())
  expect(signal.aborted).toBe(true)
  await act(async () => finish?.(snapshot([goal('1')])))
  expect(api.getSystemCartography).not.toHaveBeenCalled()
})

test('CG marker selection shows source/freshness and navigation while permanent POI filters and toggles stay independent', async () => {
  const onNavigate = vi.fn()
  const onToggleCommunityGoals = vi.fn()
  const marker = { id: 'community-goal:1', kind: 'community-goal' as const, label: 'CG · Campaign 1',
    systemName: 'Synthetic', selectedName: 'Research Port', position: [18000, 20, 40000] as const, communityGoal: goal('1') }
  const page = (showCommunityGoals: boolean) => <GalacticAtlas bookmarks={[]} communityGoals={[marker]}
    communityGoalsSnapshot={snapshot([goal('1')], 'stale')} communityGoalsStatus="CG data is stale"
    onToggleCommunityGoals={onToggleCommunityGoals} showCommunityGoals={showCommunityGoals}
    onNavigate={onNavigate} onToggleBookmarks={vi.fn()} position={null} showBookmarks systemName={null} />
  const renderer = await renderWithAct(page(true))
  try {
    const toggle = renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'Community Goal destinations')!
    expect(toggle.props['aria-pressed']).toBe(true)
    await act(async () => toggle.props.onClick())
    expect(onToggleCommunityGoals).toHaveBeenCalledOnce()
    const target = renderer.root.findAllByProps({ role: 'button' }).find(node => node.props['aria-label'] === marker.label)!
    expect(target.props.className).toContain('community-goal')
    const preventDefault = vi.fn()
    await act(async () => target.props.onKeyDown({ key: 'Enter', preventDefault }))
    expect(preventDefault).toHaveBeenCalledOnce()
    const inspector = renderer.root.findByProps({ 'aria-label': 'Selected atlas location' })
    expect(JSON.stringify(renderer.toJSON())).toContain('Stale')
    expect(inspector.findAllByType('dd').map(node => node.children).flat()).toContain('Research Port')
    expect(inspector.findAllByType('dd').map(node => node.children).flat()).toContain('3312-10-08 10:00')
    expect(inspector.findAllByType('a').find(node => node.props.href === 'https://www.elitedangerous.com/community/goals/')).toBeDefined()
    const finder = renderer.root.findAllByType('button').find(node => node.props.children === 'Finder')!
    await act(async () => finder.props.onClick())
    await act(async () => renderer.root.findByProps({ id: 'atlas-poi-search' }).props.onChange({ target: { value: 'No matching permanent POIs' } }))
    expect(renderer.root.findAllByProps({ 'aria-label': 'Selected atlas location' })).toHaveLength(1)
    expect(renderer.root.findByProps({ id: 'atlas-poi-location' }).findAllByType('option')).toHaveLength(1)
    const systemLink = inspector.findAllByType('a').find(node => node.props.href.includes('#/galaxy/system'))!
    await act(async () => systemLink.props.onClick({ button: 0, preventDefault() {} }))
    expect(onNavigate).toHaveBeenLastCalledWith(expect.objectContaining({ systemName: 'Synthetic', selectedName: 'Research Port' }))
    const goalsLink = inspector.findAllByType('a').find(node => node.props.href === '#/activities/community-goals')!
    await act(async () => goalsLink.props.onClick({ button: 0, preventDefault() {} }))
    expect(onNavigate).toHaveBeenLastCalledWith({ kind: 'information', section: 'activities', view: 'community-goals' })
    await act(async () => renderer.update(page(false)))
    expect(renderer.root.findAllByProps({ 'aria-label': 'Selected atlas location' })).toHaveLength(0)
    expect(renderer.root.findAllByProps({ role: 'button' }).some(node => node.props['aria-label'] === marker.label)).toBe(false)
    expect(JSON.stringify(renderer.toJSON())).not.toContain('CG data is stale')
    expect(renderer.root.findAllByProps({ role: 'button' }).some(node => node.props['aria-label'] === 'Colonia')).toBe(true)
  } finally { await act(async () => renderer.unmount()) }
})
