import { act } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import { createEmptyRuntimeState, GalnetAnalysisSchema, type GalnetInvestigationLeadsResponse } from '@phoenix/contracts'
import { GalnetInvestigationLeadsService } from '../apps/server/src/application/galnet-investigation-leads-service.js'
import { useAtlasGalnetLeads } from '../apps/web/src/features/galaxy/use-atlas-galnet-leads.js'
import { GalacticAtlas, GalacticAtlasPage } from '../apps/web/src/features/galaxy/galactic-atlas-page.js'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { savedGalnetAnalysis } from './support/galnet-analysis-fixtures.js'
import { renderWithAct } from './support/render-with-act.js'
import { phoenixApiStub } from './support/phoenix-api-stub.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })
function snapshot(): GalnetInvestigationLeadsResponse {
  const analysis = savedGalnetAnalysis()
  return new GalnetInvestigationLeadsService({ recent: () => [{ analysis, articleChanged: false, currentArticleTitle: 'Synthetic story' }] }).get()
}

test.each([1, 2])('page describes unknown destinations without technical legacy-report notices: %i', async count => {
  const data = snapshot()
  data.leads = []
  data.omitted = { legacyReports: count, changedReports: count, endedLeads: count, withoutDestination: count }
  const api = phoenixApiStub({ getGalnetInvestigationLeads: async () => data,
    getCommunityGoals: async () => ({ goals: [], fetchedAt: '2026-10-08T12:00:00Z', cache: 'fresh' }),
    getGalaxyBookmarks: async () => ({ bookmarks: [] }), getAtlasCatalogue: async () => ({ pois: [], sources: [] }) })
  const renderer = await renderWithAct(<GalacticAtlasPage api={api} onNavigate={vi.fn()} runtime={{ status: 'ready', state: createEmptyRuntimeState() }} />)
  try {
    const text = JSON.stringify(renderer.toJSON())
    expect(text).not.toContain('updated analysis')
    expect(text).toContain(`${count} changed-article report${count === 1 ? '' : 's'} hidden`)
    expect(text).toContain(`${count} ended lead${count === 1 ? '' : 's'} hidden`)
    expect(text).toContain(`${count} lead${count === 1 ? ' has' : 's have'} no known destination`)
  } finally { await act(async () => renderer.unmount()) }
})

test('Atlas projection includes only independent, unended, destination-backed v2 evidence from unchanged articles', () => {
  const analysis = savedGalnetAnalysis()
  analysis.content.activities.push({ ...analysis.content.activities[1]!, title: 'Ended', status: 'ended' },
    { ...analysis.content.activities[1]!, title: 'Uncertain place', destination: null })
  const legacy = GalnetAnalysisSchema.parse({ ...analysis, schemaVersion: 1, extractorVersion: 'galnet-analysis-v1',
    content: { ...analysis.content, activities: analysis.content.activities.map(({ destination: _destination, ...activity }) => activity) } })
  const recent = vi.fn(() => [
    { analysis, articleChanged: false, currentArticleTitle: 'Synthetic story' },
    { analysis: legacy, articleChanged: false, currentArticleTitle: 'Old report' },
    { analysis, articleChanged: true, currentArticleTitle: 'Corrected story' }
  ])
  const result = new GalnetInvestigationLeadsService({ recent }).get()
  expect(recent).toHaveBeenCalledWith(20)
  expect(result.omitted).toEqual({ legacyReports: 1, changedReports: 1, endedLeads: 1, withoutDestination: 1 })
  expect(result.leads).toHaveLength(1)
  expect(result.leads[0]).toMatchObject({ title: 'Investigate the beacon', systemName: 'Colonia', status: 'unknown',
    sourceUrl: analysis.sourceUrl, articleRevisionId: analysis.articleRevisionId, publishedAt: analysis.publishedAt,
    analysedAt: analysis.analysedAt, destinationEvidence: 'beacon in Colonia needs investigation' })
  expect(JSON.stringify(result)).not.toContain('Supply campaign')
})

test('lookup deduplicates names, bounds concurrency and rejects unavailable or mismatched systems without guessing', async () => {
  const data = snapshot()
  const lead = data.leads[0]!
  data.leads.push({ ...lead, id: 'duplicate', systemName: 'COLONIA' }, { ...lead, id: 'unknown', systemName: 'Unknown' },
    { ...lead, id: 'wrong', systemName: 'Wrong' }, { ...lead, id: 'offline', systemName: 'Offline' })
  const pending = new Map<string, (position: [number, number, number] | null, canonical?: string) => void>()
  const getSystemCartography = vi.fn((name: string) => name === 'Offline' ? Promise.reject(new Error('Offline')) : new Promise(resolve => {
    pending.set(name, (position, canonical = name) => resolve({ system: { name: canonical, position } }))
  }))
  const api = { getGalnetInvestigationLeads: vi.fn(async () => data), getSystemCartography } as unknown as PhoenixApi
  let state!: ReturnType<typeof useAtlasGalnetLeads>
  function Probe() { state = useAtlasGalnetLeads(api, true); return null }
  const renderer = await renderWithAct(<Probe />)
  try {
    expect(getSystemCartography).toHaveBeenCalledTimes(2)
    expect(state.loading).toBe(true)
    await act(async () => { pending.get('COLONIA')!([-9530, -910, 19808]); pending.get('Unknown')!(null) })
    await act(async () => { pending.get('Wrong')!([1, 2, 3], 'Different system') })
    expect(getSystemCartography).toHaveBeenCalledTimes(4)
    expect(state.loading).toBe(false)
    expect(state.unlocatedSystems.sort()).toEqual(['Offline', 'Unknown', 'Wrong'])
    expect(state.markers.map(marker => marker.id)).toEqual([lead.id, 'duplicate'])
    expect(state.markers[0]).toMatchObject({ kind: 'investigation', position: [-9530, -910, 19808], investigation: lead })
  } finally { await act(async () => renderer.unmount()) }
})

test('disabled layer makes no requests; disabling aborts and ignores a late snapshot, and errors are visible', async () => {
  let release!: (data: GalnetInvestigationLeadsResponse) => void
  const getGalnetInvestigationLeads = vi.fn((_signal?: AbortSignal) => new Promise<GalnetInvestigationLeadsResponse>(resolve => { release = resolve }))
  const api = { getGalnetInvestigationLeads, getSystemCartography: vi.fn() } as unknown as PhoenixApi
  let state!: ReturnType<typeof useAtlasGalnetLeads>
  function Probe({ enabled }: { enabled: boolean }) { state = useAtlasGalnetLeads(api, enabled); return null }
  const renderer = await renderWithAct(<Probe enabled={false} />)
  try {
    expect(getGalnetInvestigationLeads).not.toHaveBeenCalled()
    await act(async () => renderer.update(<Probe enabled />))
    const signal = getGalnetInvestigationLeads.mock.calls[0]![0]!
    await act(async () => renderer.update(<Probe enabled={false} />))
    expect(signal.aborted).toBe(true)
    await act(async () => release(snapshot()))
    expect(api.getSystemCartography).not.toHaveBeenCalled()
    expect(state.markers).toEqual([])
    getGalnetInvestigationLeads.mockRejectedValueOnce(new Error('Saved report read failed'))
    await act(async () => renderer.update(<Probe enabled />))
    expect(state.error).toBe('Saved report read failed')
    expect(state.loading).toBe(false)
  } finally { await act(async () => renderer.unmount()) }
})

test('lead selection shows source evidence and uncertainty, navigates to system and disappears when toggled or map dismissed', async () => {
  const lead = snapshot().leads[0]!
  const marker = { id: lead.id, label: `Lead · ${lead.title}`, kind: 'investigation' as const,
    systemName: lead.systemName, position: [18000, 20, 40000] as const, investigation: lead }
  const onNavigate = vi.fn(), onToggleInvestigations = vi.fn()
  const page = (showInvestigations: boolean) => <GalacticAtlas bookmarks={[]} investigations={[marker]}
    investigationsStatus="1 report needs updated analysis" onToggleInvestigations={onToggleInvestigations}
    showInvestigations={showInvestigations} onNavigate={onNavigate} onToggleBookmarks={vi.fn()}
    position={null} showBookmarks systemName={null} />
  const renderer = await renderWithAct(page(true))
  try {
    const toggle = renderer.root.findAllByType('button').find(node => node.props['aria-label'] === 'GalNet investigation destinations')!
    expect(toggle.props['aria-pressed']).toBe(true)
    await act(async () => toggle.props.onClick())
    expect(onToggleInvestigations).toHaveBeenCalledOnce()
    const select = async () => { await act(async () => renderer.root.findAllByProps({ role: 'button' })
      .find(node => node.props['aria-label'] === marker.label)!.props.onKeyDown({ key: 'Enter', preventDefault() {} })) }
    await select()
    const inspector = renderer.root.findByType('aside')
    const values = inspector.findAllByType('dd').flatMap(node => node.children)
    expect(values).toContain('unknown')
    expect(values).toContain('GalNet investigation · AI interpretation, not confirmed live availability')
    expect(inspector.findAllByType('a').some(node => node.props.href === lead.sourceUrl)).toBe(true)
    await act(async () => inspector.findAllByType('a').find(node => node.props.href.includes('#/galaxy/system'))!
      .props.onClick({ button: 0, preventDefault() {} }))
    expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({ systemName: lead.systemName }))
    await act(async () => renderer.root.findByProps({ className: 'atlas-viewport' }).props.onClick({ target: { closest: () => null } }))
    expect(renderer.root.findAllByType('aside')).toHaveLength(0)
    await select()
    await act(async () => renderer.update(page(false)))
    expect(renderer.root.findAllByType('aside')).toHaveLength(0)
    expect(JSON.stringify(renderer.toJSON())).not.toContain('1 report needs updated analysis')
    expect(renderer.root.findAllByProps({ role: 'button' }).some(node => node.props['aria-label'] === marker.label)).toBe(false)
  } finally { await act(async () => renderer.unmount()) }
})
