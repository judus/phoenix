import { renderToStaticMarkup } from 'react-dom/server'
import { act } from 'react-test-renderer'
import { expect, test } from 'vitest'
import { CarrierPage } from '../apps/web/src/features/fleet/carrier-page.js'
import { fleetFixture } from './fixtures/fleet-fixture.js'
import { renderWithAct } from './support/render-with-act.js'

test('empty carrier page states unknown management evidence and places WIP in header status', () => {
  const markup = renderToStaticMarkup(<CarrierPage fleet={fleetFixture()} />)
  expect(markup).toContain('Work in progress')
  expect(markup).toContain('Open Carrier Management')
  expect(markup).toContain('does not mean you own no carrier')
})
test('carrier tabs distinguish stale services, observed history and personally stored ships from sales stock', async () => {
  const fleet = fleetFixture()
  const observedAt = '2026-10-10T10:00:00Z'
  fleet.carriers = { observed: true, items: [{ id: 42, name: 'Synthetic carrier', callsign: 'SYN-001', type: 'Personal', snapshotAt: observedAt, pendingDecommission: null,
    location: { system: 'Sol', systemAddress: 1, body: null, observedAt }, fuel: null, capacity: null, finance: null, access: null, jump: null,
    services: { observedAt, changedAt: '2026-10-10T11:00:00Z', items: [{ role: 'repair', name: 'Synthetic crew', active: true, enabled: false }] },
    history: [{ id: 'synthetic', kind: 'CarrierCrewServices', timestamp: observedAt, description: 'repair · deactivate' }] }] }
  fleet.ships = [{ ...fleet.ships[0]!, id: 3, marketId: 42, name: 'Personal ship', state: 'stored-remote' }, { ...fleet.ships[0]!, id: 4, marketId: 99, name: 'Elsewhere ship', state: 'stored-remote' }]
  const renderer = await renderWithAct(<CarrierPage fleet={fleet} />)
  const select = async (label: string) => act(async () => renderer.root.findAllByProps({ role: 'tab' }).find(item => item.props.children === label)!.props.onClick())
  await select('Services')
  expect(JSON.stringify(renderer.toJSON())).toContain('Services changed after this snapshot')
  await select('Ships')
  expect(JSON.stringify(renderer.toJSON())).toContain('Personal ship')
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Elsewhere ship')
  await select('History')
  expect(JSON.stringify(renderer.toJSON())).toContain('repair · deactivate')
  await act(async () => renderer.unmount())
})
