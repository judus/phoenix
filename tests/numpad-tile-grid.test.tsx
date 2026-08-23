import { expect, test } from 'vitest'
import { balancedNumpadColumns } from '@jdu/control-deck-ui'
import { renderToStaticMarkup } from 'react-dom/server'
import { NumpadTileGrid } from '../apps/web/src/features/numpad/numpad-tile-grid.js'

test('generic numpad branches use balanced tile grids', () => {
  expect(balancedNumpadColumns(3)).toBe(3)
  expect(balancedNumpadColumns(7)).toBe(3)
  expect(balancedNumpadColumns(8)).toBe(3)
  expect(balancedNumpadColumns(40)).toBe(7)
})

test('PHOENIX passes command metadata into the shared Numpy tiles', () => {
  const markup = renderToStaticMarkup(<NumpadTileGrid
    nodes={[{
      interactionHint: 'tap',
      address: '1',
      available: true,
      bindingLabel: 'NP_5',
      id: 'lights',
      kind: 'game-action',
      label: 'Lights',
      parentId: null,
      risk: 'safe',
      selector: '1',
      target: { type: 'game-action', actionId: 'elite.ShipSpotLightToggle' }
    }]}
    pendingDigits=""
    variableFontSizes
    onSelect={() => undefined}
  />)

  expect(markup).toContain('class="meta"')
  expect(markup).toContain('NP_5')
  expect(markup).toContain('class="note"')
  expect(markup).toContain('tap')
})
