import { act } from 'react-test-renderer'
import { expect, test, vi } from 'vitest'
import type { CommunityGoal, GalaxyBookmark } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import { useAtlasBookmarks } from '../apps/web/src/features/galaxy/use-atlas-bookmarks.js'
import { useAtlasCommunityGoals } from '../apps/web/src/features/galaxy/use-atlas-community-goals.js'
import { useAtlasGalnetLeads } from '../apps/web/src/features/galaxy/use-atlas-galnet-leads.js'
import { GalnetInvestigationLeadsService } from '../apps/server/src/application/galnet-investigation-leads-service.js'
import { savedGalnetAnalysis } from './support/galnet-analysis-fixtures.js'
import { renderWithAct } from './support/render-with-act.js'
import { phoenixApiStub } from './support/phoenix-api-stub.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const layers = [
  { name: 'bookmarks', useLayer: useAtlasBookmarks },
  { name: 'Community Goals', useLayer: useAtlasCommunityGoals },
  { name: 'GalNet leads', useLayer: useAtlasGalnetLeads }
]

test.each(layers)('$name refresh keeps markers until complete, replaces without duplicates, retains on error and clears on empty', async ({ useLayer }) => {
  const analysis = savedGalnetAnalysis()
  const lead = new GalnetInvestigationLeadsService({ recent: () => [{ analysis, articleChanged: false,
    contextChanged: false, currentArticleTitle: 'Synthetic story' }] }).get().leads[0]!
  let names = ['Initial']
  let fetchGate = deferred<void>()
  const fetches: AbortSignal[] = []
  const fetchSnapshot = async (signal?: AbortSignal) => { fetches.push(signal!); await fetchGate.promise; return names }
  const coordinates = new Map<string, ReturnType<typeof deferred<Awaited<ReturnType<PhoenixApi['getSystemCartography']>>>>>()
  let delayCoordinates = false
  const cartography = (name: string) => ({ system: { name, position: [18000, 50, 40000] } }) as Awaited<ReturnType<PhoenixApi['getSystemCartography']>>
  const api = phoenixApiStub({
    getGalaxyBookmarks: async signal => ({ bookmarks: (await fetchSnapshot(signal)).map((name): GalaxyBookmark => ({
      id: name, target: { kind: 'system', systemName: name }, tags: [], note: null, createdAt: '', updatedAt: ''
    })) }),
    getCommunityGoals: async signal => ({ cache: 'fresh', fetchedAt: '2026-10-09T12:00:00Z',
      goals: (await fetchSnapshot(signal)).map((name): CommunityGoal => ({
        id: name, title: name, systemName: name, stationName: 'Test Port', activityType: 'trade',
        objective: 'Test delivery', targetCommodities: 'Water', contributed: 1, target: 10,
        expiry: '2026-10-10 10:00:00', briefing: 'Synthetic campaign.'
      })) }),
    getGalnetInvestigationLeads: async signal => ({ reportLimit: 20,
      omitted: { legacyReports: 0, changedReports: 0, endedLeads: 0, withoutDestination: 0 },
      leads: (await fetchSnapshot(signal)).map(name => ({ ...lead, id: name, title: name, systemName: name })) }),
    getSystemCartography: vi.fn(async name => {
      if (!delayCoordinates) return cartography(name!)
      const pending = deferred<Awaited<ReturnType<PhoenixApi['getSystemCartography']>>>()
      coordinates.set(name!, pending)
      return pending.promise
    })
  })
  let state!: ReturnType<typeof useLayer>
  function Probe({ enabled }: { enabled: boolean }) { state = useLayer(api, enabled); return null }
  const renderer = await renderWithAct(<Probe enabled />)
  const visible = () => state.markers.map(marker => marker.systemName)
  const toggle = async () => {
    await act(async () => renderer.update(<Probe enabled={false} />))
    await act(async () => renderer.update(<Probe enabled />))
  }
  try {
    await act(async () => fetchGate.resolve())
    expect(visible()).toEqual(['Initial'])
    fetchGate = deferred<void>()
    names = ['Replacement A', 'Replacement B']
    delayCoordinates = true
    await toggle()
    expect(visible()).toEqual(['Initial'])
    await act(async () => fetchGate.resolve())
    expect(visible()).toEqual(['Initial'])
    await act(async () => coordinates.get('Replacement A')!.resolve(cartography('Replacement A')))
    expect(visible()).toEqual(['Initial'])
    await act(async () => coordinates.get('Replacement B')!.resolve(cartography('Replacement B')))
    expect(visible().sort()).toEqual(['Replacement A', 'Replacement B'])

    fetchGate = deferred<void>()
    await toggle()
    await act(async () => fetchGate.reject(new Error('Refresh offline')))
    expect(state.error).toBe('Refresh offline')
    expect(visible().sort()).toEqual(['Replacement A', 'Replacement B'])

    fetchGate = deferred<void>()
    names = []
    await toggle()
    expect(state.error).toBeUndefined()
    expect(visible()).toHaveLength(2)
    await act(async () => fetchGate.resolve())
    expect(visible()).toEqual([])

    fetchGate = deferred<void>()
    names = ['Obsolete request']
    await toggle()
    const obsolete = fetches.at(-1)!
    await act(async () => fetchGate.resolve())
    await act(async () => renderer.update(<Probe enabled={false} />))
    expect(obsolete.aborted).toBe(true)
    fetchGate = deferred<void>()
    names = ['Current request']
    await act(async () => renderer.update(<Probe enabled />))
    await act(async () => fetchGate.resolve())
    await act(async () => coordinates.get('Current request')!.resolve(cartography('Current request')))
    await act(async () => coordinates.get('Obsolete request')!.resolve(cartography('Obsolete request')))
    expect(visible()).toEqual(['Current request'])
  } finally {
    await act(async () => renderer.unmount())
  }
})
