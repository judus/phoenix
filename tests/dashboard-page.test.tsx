import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { DashboardPage } from '../apps/web/src/features/dashboard/dashboard-page.js'
import type { DashboardViewModel } from '../apps/web/src/features/dashboard/dashboard-view-model.js'

test('dashboard exposes degraded evidence and preserves radio control order', () => {
  const markup = renderToStaticMarkup(
    <DashboardPage
      controller={{ activity: [], error: 'Dashboard query unavailable.', status: 'error' }}
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
  expect(markup).toContain('No recent activity retained.')
  expect(markup.indexOf('aria-label="Previous"')).toBeLessThan(markup.indexOf('aria-label="Stop"'))
  expect(markup.indexOf('aria-label="Stop"')).toBeLessThan(markup.indexOf('aria-label="Play"'))
  expect(markup.indexOf('aria-label="Play"')).toBeLessThan(markup.indexOf('aria-label="Next"'))
})

test('dashboard identifies its loading state without replacing the shell', () => {
  const markup = renderToStaticMarkup(
    <DashboardPage
      controller={{ activity: [], status: 'loading' }}
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
  expect(markup).toContain('Loading retained activity…')
  expect(markup).not.toContain('application-shell')
})

function model(): DashboardViewModel {
  return {
    activity: [],
    commander: { credits: '—', name: 'Identity pending' },
    route: { current: 'Current system unknown', destination: 'No route plotted', detail: 'Navigation computer idle' },
    ship: { cargo: '—', hull: '—', identifier: 'Loadout pending', jumpRange: '—', name: 'No ship identified' },
    situation: { allegiance: '—', economy: '—', place: 'Establishing telemetry link', population: '—', security: '—', system: 'Unknown system' },
    warnings: []
  }
}
