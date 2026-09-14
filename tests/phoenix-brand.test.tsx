import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { PhoenixBrand } from '../apps/web/src/components/shell/phoenix-brand.js'

test('the PHOENIX lockup gives both wordmark lines the same measured width', () => {
  const markup = renderToStaticMarkup(<PhoenixBrand />)

  expect(markup).toContain('aria-label="Phoenix Control Deck"')
  expect(markup).toContain('>PHOENIX</text>')
  expect(markup).toContain('>CONTROL DECK</text>')
  expect(markup.match(/textLength="200"/g)).toHaveLength(2)
  expect(markup.match(/lengthAdjust="spacing"/g)).toHaveLength(2)
})
