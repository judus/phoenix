import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { HelpPage } from '../apps/web/src/features/settings/help-page.js'
import { settingsNavigationItems } from '../apps/web/src/features/settings/settings-navigation.js'

test('Settings integrates the indexed Help manual as a canonical destination', () => {
  expect(settingsNavigationItems.map(item => [item.label, item.href])).toEqual([
    ['Settings', '#/settings'],
    ['Help', '#/settings/help']
  ])

  const markup = renderToStaticMarkup(<HelpPage />)
  expect(markup).toContain('aria-label="Help topics"')
  expect(markup).toContain('item-list compact surface')
  expect(markup).toContain('Pairing a device')
  expect(markup).toContain('How PHOENIX gets its data')
  expect(markup).toContain('Control Deck and application focus')
  expect(markup).toContain('Frontier synchronizes commander state, not the complete local journal archive')
  expect(markup).toContain('Starport Services → Shipyard')
  expect(markup).toContain('Starport Services → Outfitting')
  expect(markup).not.toContain('class="widget')
})
