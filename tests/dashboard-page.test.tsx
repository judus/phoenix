import { renderToStaticMarkup } from 'react-dom/server'
import { act, create } from 'react-test-renderer'
import { expect, test, vi } from 'vitest'
import { DashboardPage } from '../apps/web/src/features/dashboard/dashboard-page.js'
import type { DashboardViewModel } from '../apps/web/src/features/dashboard/dashboard-view-model.js'

test('dashboard exposes degraded evidence and preserves radio control order', () => {
  const markup = renderToStaticMarkup(
    <DashboardPage
      controller={{ commanderLog: [], error: 'Dashboard query unavailable.', localTraffic: localTraffic(), materialWatchlist: materialWatchlist(), status: 'error' }}
      eventConnection={{ state: 'error', error: 'Live events disconnected.' }}
      hrefFor={() => '#/typed'}
      model={model()}
      onExecuteAction={vi.fn()}
      onInspectMarketSignal={vi.fn()}
      onNavigate={vi.fn()}
      runtime={{ status: 'error', error: 'Runtime unavailable.' }}
      voice={{
        connected: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        error: 'Voice unavailable.',
        mark: 'M',
        name: 'Marin',
        status: 'Offline',
        transitioning: false
      }}
    />
  )

  expect(markup).toContain('Dashboard query unavailable.')
  expect(markup).toContain('Live events disconnected.')
  expect(markup).toContain('Runtime unavailable.')
  expect(markup).toContain('Voice unavailable.')
  expect(markup).toContain('No notable commander events retained.')
  expect(markup).toMatch(/<span>Commander<\/span><h3[^>]*>IDENTITY PENDING<\/h3>/)
  expect(markup).toMatch(/<span>Current location<\/span><h3[^>]*>UNKNOWN SYSTEM<\/h3>/)
  expect(markup).toContain('aria-label="Commander log"')
  expect(markup).toContain('<span>Commander log</span>')
  expect(markup).toContain('Local traffic')
  expect(markup).toContain('Material watchlist')
  expect(markup).toContain('<ul class="dashboard-material-watchlist"><li><span>Arsenic</span><span>0/1</span></li></ul>')
  expect(markup).not.toContain('0 owned')
  expect(markup).not.toContain('1 planned')
  expect(markup).not.toContain('1 missing')
  expect(markup).not.toContain('raw · G2')
  expect(markup).toContain('No recent local communications observed.')
  expect(markup).toContain('panel panel-danger dashboard-alerts')
  expect(markup).not.toContain('<h3>Commander log</h3>')
  expect(markup).toContain('Attention</h3>')
  expect(markup).toContain('<span>Total credits</span><strong><span class="currency">—</span></strong>')
  expect(markup).toContain('<dt>Legal status</dt><dd>—</dd>')
  expect(markup.indexOf('aria-label="Previous"')).toBeLessThan(markup.indexOf('aria-label="Stop"'))
  expect(markup.indexOf('aria-label="Stop"')).toBeLessThan(markup.indexOf('aria-label="Play"'))
  expect(markup.indexOf('aria-label="Play"')).toBeLessThan(markup.indexOf('aria-label="Next"'))
})

test('dashboard identifies its loading state without replacing the shell', () => {
  const markup = renderToStaticMarkup(
    <DashboardPage
      controller={{ commanderLog: [], status: 'loading' }}
      eventConnection={{ state: 'connecting' }}
      hrefFor={() => '#/typed'}
      model={model()}
      onExecuteAction={vi.fn()}
      onInspectMarketSignal={vi.fn()}
      onNavigate={vi.fn()}
      runtime={{ status: 'loading' }}
      voice={{
        connected: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        mark: 'M',
        name: 'Marin',
        status: 'Offline',
        transitioning: false
      }}
    />
  )

  expect(markup).toContain('aria-busy="true"')
  expect(markup).toContain('Loading commander history…')
  expect(markup).toContain('Listening for local traffic…')
  expect(markup).not.toContain('application-shell')
  expect(markup).toContain('class="page-frame page-flow dashboard-page"')
})

test('dashboard market signals open the targeted commodity query path', async () => {
  const onInspectMarketSignal = vi.fn()
  const signals = marketSignals()
  let renderer: ReturnType<typeof create>
  await act(async () => {
    renderer = create(<DashboardPage
      controller={{ commanderLog: [], marketSignals: signals, status: 'ready' }}
      eventConnection={{ state: 'open' }}
      hrefFor={() => '#/galaxy/database?query=commodity-markets'}
      model={model()}
      onExecuteAction={vi.fn()}
      onInspectMarketSignal={onInspectMarketSignal}
      onNavigate={vi.fn()}
      runtime={{ status: 'ready', state: undefined as never }}
      voice={{ connected: false, connect: vi.fn(), disconnect: vi.fn(), mark: 'M', name: 'Marin', status: 'Offline', transitioning: false }}
    />)
  })
  const signalLink = renderer.root.findAllByType('a').find(link => link.findAll(node => node.children.includes('Gold')).length > 0)!
  expect(signalLink.findByType('small').children.join('')).toBe("Buy 2'500 CR · Galileo")
  expect(renderer.root.findByProps({ className: 'dashboard-market-signal-summary' }).children.at(-1)?.props.children).toBe("500 t")
  await act(async () => signalLink.props.onClick({ preventDefault: vi.fn() }))
  expect(onInspectMarketSignal).toHaveBeenCalledWith(signals.result!.signals[0])
  await act(async () => renderer.unmount())
})

function model(): DashboardViewModel {
  return {
    commanderLog: [],
    localTraffic: [],
    commander: { credits: null, legalState: null, name: 'Identity pending', notoriety: null },
    route: { destination: 'No route plotted', detail: 'Navigation computer idle', nextStarClass: '—', nextSystem: '—' },
    ship: { cargo: '—', hull: '—', identifier: 'Loadout pending', jumpRange: '—', name: 'No ship identified' },
    situation: { allegiance: '—', economy: '—', place: 'Establishing telemetry link', population: '—', security: '—', system: 'Unknown system' },
    warnings: []
  }
}

function localTraffic() {
  return { generatedAt: '2026-08-16T12:00:00.000Z', messages: [], schemaVersion: 1 as const, windowMinutes: 90 }
}

function materialWatchlist() {
  return {
    activeProjectCount: 1,
    materials: [{
      category: 'raw',
      grade: 2,
      highestPriority: 'normal' as const,
      materialId: 'Arsenic',
      materialName: 'Arsenic',
      missing: 1,
      owned: 0,
      projectCount: 1,
      projects: [{ id: 'project-1', name: 'Explorer refit' }],
      required: 1,
      stepCount: 1
    }],
    observedAt: '2026-09-13T12:00:00.000Z',
    schemaVersion: 1 as const
  }
}

function marketSignals() {
  return {
    configuration: { id: '00000000-0000-4000-8000-000000000001', name: 'Local bargains' },
    result: {
      cache: 'fresh' as const,
      caveat: 'Community reports may be stale.',
      filters: { includeFleetCarriers: false, maxDaysAgo: 3, minDeviationPercent: 20, minimumPadSize: 'medium' as const, minVolume: 100, sides: ['buy' as const] },
      originSystem: 'Sol',
      provenance: 'Ardent Insight community market reports' as const,
      schemaVersion: 1 as const,
      scope: 'current-system' as const,
      signals: [{
        baselinePrice: 10_000, baselineUpdatedAt: '2026-09-13T00:00:00.000Z', commodityName: 'Gold', commoditySymbol: 'Gold',
        deviationPercent: 75, distanceLy: 0, distanceToArrivalLs: 320, marketId: 42,
        maxLandingPadSize: 3, price: 2_500, provider: 'Ardent Insight' as const, side: 'buy' as const,
        stationName: 'Galileo', stationType: 'Orbis', systemName: 'Sol', unlimitedVolume: false,
        updatedAt: '2026-09-13T11:00:00.000Z', volume: 500
      }]
    },
    schemaVersion: 1 as const,
    state: 'ready' as const
  }
}
