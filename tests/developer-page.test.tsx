import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { DeveloperPage } from '../apps/web/src/pages/developer-page.js'

test('the developer area uses the shared shell and its own secondary navigation', () => {
  const markup = renderToStaticMarkup(
    <DeveloperPage
      health={{
        apiVersion: '1',
        database: { connected: true, engine: 'sqlite' },
        name: 'PHOENIX',
        status: 'ok',
        timestamp: '2026-08-10T00:00:00.000Z'
      }}
      runtimeState={createEmptyRuntimeState()}
      view="runtime"
    />
  )

  expect(markup).toContain('class="app-shell"')
  expect(markup).toContain('aria-label="Developer tools"')
  expect(markup).toContain('href="#/developer/health"')
  expect(markup).toContain('aria-current="page"')
  expect(markup).toContain('<main class="page">')
  expect(markup).toContain('Validated runtime snapshot')
  expect(markup).toContain('&quot;schemaVersion&quot;: 1')
})
