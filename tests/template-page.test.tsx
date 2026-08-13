import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { TemplatePage } from '../apps/web/src/pages/template-page.js'

test('the template page composes the shared application layout', () => {
  const markup = renderToStaticMarkup(<TemplatePage health={{
    apiVersion: '1',
    database: { connected: true, engine: 'sqlite' },
    name: 'PHOENIX',
    status: 'ok',
    timestamp: '2026-08-10T00:00:00.000Z'
  }} />)

  expect(markup).toContain('class="app-shell"')
  expect(markup).toContain('aria-label="Primary navigation"')
  expect(markup).toContain('aria-label="Section navigation"')
  expect(markup).toContain('href="#/commander/overview"')
  expect(markup).toContain('href="#/galaxy/system"')
  expect(markup).toContain('<main class="page">')
  expect(markup).toContain('class="page-header"')
  expect(markup).toContain('class="page-content page-content--inset"')
  expect(markup).not.toContain('class="page-footer"')
})
