import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import type { DevicePreferences } from '../apps/web/src/application/settings/device-preferences.js'
import { NumpadPage } from '../apps/web/src/features/numpad/numpad-page.js'
import { numpadRuntimeFixture } from './support/numpad-runtime-fixture.js'

const devicePreferences = (variableCommandLabelSizes = true) => ({
  getSnapshot: () => ({ version: 2 as const, audioInputId: '', audioOutputId: '', captureNumpad: true, currentShipLoadoutView: 'tiles' as const, followCopilotNavigation: true, presentation: 'phoenix' as const, shipCatalogueView: 'dossier' as const, uiScalePercent: 100, variableCommandLabelSizes }),
  subscribe: () => () => {},
  update: () => {}
}) satisfies DevicePreferences

test('the numpad renders the live command navigator without owning its input', async () => {
  const fixture = numpadRuntimeFixture()
  fixture.runtime.start()
  await fixture.settle()
  const markup = renderToStaticMarkup(<NumpadPage runtime={fixture.runtime} devicePreferences={devicePreferences()} />)
  expect(markup).not.toContain('<h1>')
  expect(markup).toContain('--numpad-columns:3')
  expect(markup).toContain('show-background-numbers')
  expect(markup).toContain('variable-font-sizes')
  expect(markup).toContain('data-selector="1"')
  expect(markup).toContain('Press Numpad 0')
  expect(markup).toContain('Controls')
  expect(markup).toContain('<small>Cancel</small>')
  expect(markup).toContain('Esc / .')
  expect(markup).toContain('Cancel Numpy (Escape or decimal point)')
  expect(markup).not.toContain('Numpad views')
  fixture.runtime.stop()
})

test('the numpad workspace remains available independently of physical key capture', async () => {
  const fixture = numpadRuntimeFixture()
  fixture.runtime.start()
  await fixture.settle()
  const preferences = devicePreferences(false)
  const markup = renderToStaticMarkup(<NumpadPage runtime={fixture.runtime} devicePreferences={{ ...preferences, getSnapshot: () => ({ ...preferences.getSnapshot(), captureNumpad: false }) }} />)
  expect(markup).toContain('Press Numpad 0')
  expect(markup).not.toContain('responsive-button-font-sizes')
  expect(markup).not.toContain('Enable numpad')
  fixture.runtime.stop()
})
