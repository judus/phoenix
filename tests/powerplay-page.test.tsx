import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { PowerplayPage } from '../apps/web/src/features/activities/powerplay-page.js'

test('Powerplay keeps a visible unfinished-feature marker even before journal data arrives', () => {
  const markup = renderToStaticMarkup(<PowerplayPage controller={{ status: 'loading', saving: false, saveTarget: async () => {} }} />)
  expect(markup).toContain('status-danger')
  expect(markup).toContain('Work in progress')
  expect(markup).toContain('page-status')
  expect(markup.indexOf('Work in progress')).toBeGreaterThan(markup.indexOf('aria-label="Breadcrumb"'))
  expect(markup).toContain('Loading Powerplay')
})
