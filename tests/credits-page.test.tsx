import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { CreditsPage } from '../apps/web/src/features/journal/credits-page.js'

test('credits the local, bundled, live and optional data sources', () => {
  const markup = renderToStaticMarkup(<CreditsPage />)

  expect(markup).toContain('Journal files')
  expect(markup).toContain('EDCD · FDevIDs')
  expect(markup).toContain('EDCD · Coriolis Data')
  expect(markup).toContain('EDSM')
  expect(markup).toContain('Spansh')
  expect(markup).toContain('Ardent Insight')
  expect(markup).toContain('OpenAI')
})
