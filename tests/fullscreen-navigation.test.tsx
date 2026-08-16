import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { Navigation } from '@phoenix/ui'

test('fullscreen is exposed as a synchronized navigation action, not a route', () => {
  const markup = renderToStaticMarkup(
    <Navigation
      current="info"
      items={[{
        id: 'fullscreen',
        kind: 'action',
        label: 'Exit fullscreen',
        shortLabel: '⛶',
        pressed: true
      }]}
      label="Utilities"
      variant="compact"
    />
  )

  expect(markup).toContain('<button type="button" class="nav-item active"')
  expect(markup).toContain('aria-label="Exit fullscreen"')
  expect(markup).toContain('aria-pressed="true"')
  expect(markup).not.toContain('href=')
})
