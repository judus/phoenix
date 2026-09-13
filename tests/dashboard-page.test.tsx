import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { DashboardPage } from '../apps/web/src/features/dashboard/dashboard-page.js'
import type { DashboardViewModel } from '../apps/web/src/features/dashboard/dashboard-view-model.js'

test('dashboard exposes degraded evidence and preserves radio control order', () => {
  const markup = renderToStaticMarkup(
    <DashboardPage
      controller={{ commanderLog: [], error: 'Dashboard query unavailable.', localTraffic: localTraffic(), status: 'error' }}
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
  expect(markup).toMatch(/<span>Situation<\/span><h3[^>]*>UNKNOWN SYSTEM<\/h3>/)
  expect(markup).toContain('aria-label="Commander log"')
  expect(markup).toContain('<span>Commander log</span>')
  expect(markup).toContain('Local traffic')
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
})

function model(): DashboardViewModel {
  return {
    commanderLog: [],
    localTraffic: [],
    commander: { credits: null, legalState: null, name: 'Identity pending', notoriety: null },
    route: { current: 'Current system unknown', destination: 'No route plotted', detail: 'Navigation computer idle' },
    ship: { cargo: '—', hull: '—', identifier: 'Loadout pending', jumpRange: '—', name: 'No ship identified' },
    situation: { allegiance: '—', economy: '—', place: 'Establishing telemetry link', population: '—', security: '—', system: 'Unknown system' },
    warnings: []
  }
}

function localTraffic() {
  return { generatedAt: '2026-08-16T12:00:00.000Z', messages: [], schemaVersion: 1 as const, windowMinutes: 90 }
}
