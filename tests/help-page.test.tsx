import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { HelpPage } from '../apps/web/src/features/settings/help-page.js'
import { settingsNavigationItems } from '../apps/web/src/features/settings/settings-navigation.js'

test('Settings integrates Help and Q&A as a canonical destination', () => {
  expect(settingsNavigationItems.map(item => [item.label, item.href])).toEqual([
    ['Settings', '#/settings'],
    ['Help & Q&A', '#/settings/help']
  ])

  const markup = renderToStaticMarkup(<HelpPage />)
  expect(markup).toContain('Why is a page empty when Elite has the data?')
  expect(markup).toContain('Frontier synchronizes commander state, not the complete local journal archive')
  expect(markup).toContain('Starport Services → Shipyard')
  expect(markup).toContain('Starport Services → Outfitting')
})
