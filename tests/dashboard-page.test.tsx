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
      onNavigate={vi.fn()}
      runtime={{ status: 'error', error: 'Runtime unavailable.' }}
      voice={{
        connected: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        error: 'Voice unavailable.',
        transitioning: false
      }}
    />
  )

  expect(markup).toContain('Dashboard query unavailable.')
  expect(markup).toContain('Live events disconnected.')
  expect(markup).toContain('Runtime unavailable.')
  expect(markup).toContain('Voice unavailable.')
  expect(markup).toContain('No notable commander events retained.')
  expect(markup).toContain('<dt>Commander</dt><dd><strong>IDENTITY PENDING</strong></dd>')
  expect(markup).toMatch(/<span>Current location<\/span><h3[^>]*>UNKNOWN SYSTEM<\/h3>/)
  expect(markup).toContain('aria-label="Commander log"')
  expect(markup).toContain('<span>Commander log</span>')
  expect(markup).toContain('Local traffic')
  expect(markup).toContain('>Traffic log</a>')
  expect(markup).toContain('Material watchlist')
  expect(markup).toContain('class="item-list dense" aria-label="Material watchlist"')
  expect(markup).toContain('class="dashboard-material-watchlist-item"')
  expect(markup).toContain('<span class="numeric">0/1</span>')
  expect(markup).toContain('<dt>Population</dt><dd><span class="numeric">—</span></dd>')
  expect(markup).toContain('<span>Hull</span><strong><span class="numeric">—</span></strong>')
  expect(markup).toContain('<span>Cargo</span><strong><span class="numeric">—</span></strong>')
  expect(markup).toContain('<span>Jump</span><strong><span class="numeric">—</span></strong>')
  expect(markup).toContain('>View ship</a>')
  expect(markup).not.toContain('>Ship controls</a>')
  expect(markup).toContain('>System schematic</a>')
  expect(markup).toContain('>View route</a>')
  expect(markup).not.toContain('0 owned')
  expect(markup).not.toContain('1 planned')
  expect(markup).not.toContain('1 missing')
  expect(markup).not.toContain('raw · G2')
  expect(markup).toContain('No recent local communications observed.')
  expect(markup).toContain('panel panel-danger dashboard-alerts')
  expect(markup).toContain('role="alert"')
  expect(markup).toContain('aria-label="Dismiss dashboard alert"')
  expect(markup).not.toContain('<h3>Commander log</h3>')
  expect(markup).toContain('Attention</h3>')
  expect(markup).toContain('<div class="label-action"><dt>Credits</dt><dd><span class="currency">—</span></dd></div>')
  expect(markup).toContain('<dt>Legal status</dt><dd>—</dd>')
  expect(markup).toContain('aria-label="Connect Copilot voice"')
  expect(markup).toContain('>COPILOT<')
  expect(markup).toContain('aria-label="Toggle GalNet Radio playback"')
  expect(markup).toContain('aria-label="Target next route system"')
  expect(markup).toContain('aria-label="Request docking unavailable"')
  expect(markup).not.toContain('>Unbound<')
  expect(markup).not.toContain('<span>GalNet radio</span>')
  expect(markup).not.toContain('aria-label="Copilot"')
})

test('dashboard identifies its loading state without replacing the shell', () => {
  const markup = renderToStaticMarkup(
    <DashboardPage
      controller={{ commanderLog: [], status: 'loading' }}
      eventConnection={{ state: 'connecting' }}
      hrefFor={() => '#/typed'}
      model={model()}
      onExecuteAction={vi.fn()}
      onNavigate={vi.fn()}
      runtime={{ status: 'loading' }}
      voice={{
        connected: false,
        connect: vi.fn(),
        disconnect: vi.fn(),
        transitioning: false
      }}
    />
  )

  expect(markup).toContain('aria-busy="true"')
  expect(markup).toContain('Loading commander history…')
  expect(markup).toContain('Listening for local traffic…')
  expect(markup).not.toContain('application-shell')
  expect(markup).toContain('class="page-frame page-fit dashboard-page"')
})

test('dashboard market signal rows remain informational', async () => {
  const signals = marketSignals()
  let renderer: ReturnType<typeof create>
  await act(async () => {
    renderer = create(<DashboardPage
      controller={{ commanderLog: [], marketSignals: signals, status: 'ready' }}
      eventConnection={{ state: 'open' }}
      hrefFor={() => '#/galaxy/database?query=commodity-markets'}
      model={model()}
      onExecuteAction={vi.fn()}
      onNavigate={vi.fn()}
      runtime={{ status: 'ready', state: undefined as never }}
      voice={{ connected: false, connect: vi.fn(), disconnect: vi.fn(), transitioning: false }}
    />)
  })
  const signalRow = renderer.root.findByProps({ 'aria-label': 'Market signals' }).findByType('li')
  expect(signalRow.findByType('p').children.join('')).toBe("Buy 2'500 CR · Galileo")
  expect(renderer.root.findByProps({ className: 'dashboard-market-signal-summary' }).children.at(-1)?.props.children).toBe("500 t")
  expect(signalRow.findAllByType('a')).toEqual([])
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
