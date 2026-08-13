import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { PhoenixTopBar } from '../apps/web/src/components/layout/phoenix-shell.js'
import { NumpadPage } from '../apps/web/src/pages/numpad-page.js'

test('the top bar exposes the dedicated numpad surface', () => {
  const markup = renderToStaticMarkup(<PhoenixTopBar numpadSection />)

  expect(markup).toContain('href="#/numpad"')
  expect(markup).toContain('aria-label="Numpad command navigator"')
  expect(markup).toContain('aria-current="page"')
})

test('the numpad page reserves a standalone command navigator surface', () => {
  const markup = renderToStaticMarkup(<NumpadPage />)

  expect(markup).toContain('<main class="page numpad-page">')
  expect(markup).toContain('Command navigator')
  expect(markup).toContain('Command map pending')
})
