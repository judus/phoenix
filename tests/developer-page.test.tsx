import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { PlaceholderPage } from '../apps/web/src/components/shell/placeholder-page.js'

test('the developer route clearly renders its current placeholder surface', () => {
  const markup = renderToStaticMarkup(
    <PlaceholderPage
      context="Log · Developer"
      description="Runtime inspection and diagnostics"
      title="Developer tools"
    />
  )

  expect(markup).toContain('class="page-frame page-flow"')
  expect(markup).toContain('Log · Developer')
  expect(markup).toContain('<h1>Developer tools</h1>')
  expect(markup).toContain('Runtime inspection and diagnostics')
})
