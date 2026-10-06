import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { act } from 'react-test-renderer'
import { renderWithAct } from './support/render-with-act.js'
import type { DevicePreferences } from '../apps/web/src/application/settings/device-preferences.js'
import { NumpadPage } from '../apps/web/src/features/numpad/numpad-page.js'
import { numpadRuntimeFixture, numpadTree } from './support/numpad-runtime-fixture.js'

const devicePreferences = (variableCommandLabelSizes = true) => ({
  getSnapshot: () => ({ version: 2 as const, audioInputId: '', audioOutputId: '', captureNumpad: true, currentShipLoadoutView: 'tiles' as const, followCopilotNavigation: true, presentation: 'phoenix' as const, shipCatalogueView: 'dossier' as const, uiScalePercent: 100, variableCommandLabelSizes }),
  subscribe: () => () => {},
  update: () => {}
}) satisfies DevicePreferences

test('ambiguous addresses use a compact prompt retaining both choices', async () => {
  const fixture = numpadRuntimeFixture()
  const action = numpadTree.nodes[2]!
  fixture.api.getNumpadSnapshot.mockResolvedValue({ ...numpadTree, nodes: [
    ...numpadTree.nodes.slice(0, 2),
    { ...action, selector: '1', address: '111' },
    { ...action, id: 'longer', selector: '12', address: '1112' }
  ] })
  fixture.runtime.start()
  await fixture.settle()
  for (const digit of ['0', '1', '1', '1']) fixture.key(digit)
  for (const paint of fixture.paints.splice(0)) paint()
  expect(fixture.runtime.controller.getSnapshot().session.status).toBe('ambiguous')
  const markup = renderToStaticMarkup(<NumpadPage runtime={fixture.runtime} devicePreferences={devicePreferences()} />)
  expect(markup).toContain('<small>Status</small><strong>Digit or Enter</strong>')
  expect(markup).not.toContain('Enter another digit or press Enter')
  fixture.runtime.stop()
})

test('the Cancel header remains an actionable label and key stack', async () => {
  const fixture = numpadRuntimeFixture()
  fixture.runtime.start()
  await fixture.settle()
  fixture.key('0')
  const preferences = devicePreferences()
  const snapshot = preferences.getSnapshot()
  preferences.getSnapshot = () => snapshot
  const renderer = await renderWithAct(<NumpadPage runtime={fixture.runtime} devicePreferences={preferences} />)
  const cancel = renderer.root.findByProps({ 'aria-label': 'Cancel Numpy (Escape or decimal point)' })
  expect(cancel.type).toBe('button')
  expect(cancel.findByType('small').children).toEqual(['Cancel'])
  expect(cancel.findByType('strong').children).toEqual(['Esc / .'])
  await act(async () => cancel.props.onClick())
  expect(fixture.routeSession.leave).toHaveBeenCalledOnce()
  await act(async () => renderer.unmount())
  fixture.runtime.stop()
})

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
  expect(markup).not.toContain('variable-font-sizes')
  expect(markup).not.toContain('Enable numpad')
  fixture.runtime.stop()
})
