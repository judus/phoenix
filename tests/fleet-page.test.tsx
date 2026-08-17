import { createEmptyRuntimeState } from '@phoenix/contracts'
import type { ShipDefinition } from '@phoenix/contracts'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { FleetPage } from '../apps/web/src/features/fleet/fleet-page.js'
import { fleetNavigationItems } from '../apps/web/src/features/fleet/fleet-navigation.js'
import { fleetFixture } from './fixtures/fleet-fixture.js'

test('Fleet supplies feature-owned contextual destinations', () => {
  expect(fleetNavigationItems.map(item => [item.label, item.href])).toEqual([
    ['Overview', '#/fleet/overview'],
    ['Current ship', '#/fleet/ships/current/overview'],
    ['Carriers', '#/fleet/carriers'],
    ['Stored modules', '#/fleet/stored-modules'],
    ['Ship catalogue', '#/fleet/catalogue']
  ])
})

test('Fleet overview and current ship render live records without shell chrome', () => {
  const overview = renderToStaticMarkup(<FleetPage controller={{ fleet: fleetFixture(), status: 'ready' }} onNavigate={vi.fn()} route={{ kind: 'information', section: 'fleet', view: 'overview' }} runtime={{ status: 'loading' }} />)
  const state = { ...createEmptyRuntimeState(), ship: { ...createEmptyRuntimeState().ship, name: 'Prospector', identifier: 'EL-06L' } }
  const current = renderToStaticMarkup(<FleetPage controller={{ status: 'idle' }} onNavigate={vi.fn()} route={{ kind: 'information', section: 'fleet', view: 'current-overview' }} runtime={{ status: 'ready', state }} />)
  const loadout = renderToStaticMarkup(<FleetPage controller={{ status: 'idle' }} onNavigate={vi.fn()} route={{ kind: 'information', section: 'fleet', view: 'current-loadout' }} runtime={{ status: 'ready', state }} />)
  const engineering = renderToStaticMarkup(<FleetPage controller={{ status: 'idle' }} onNavigate={vi.fn()} route={{ kind: 'information', section: 'fleet', view: 'current-engineering' }} runtime={{ status: 'ready', state }} />)

  expect(overview).toContain('Owned vessels')
  expect(overview).toContain('MURDOCK')
  expect(overview).toContain('No authoritative record observed')
  expect(current).toContain('Prospector')
  expect(current).not.toContain('Current ship views')
  expect(current).toContain('Loadout')
  expect(current).toContain('Engineering')
  expect(current).toContain('Unbound')
  expect(current).not.toContain('application-shell')
  expect(loadout).toContain('href="#/fleet/overview">Fleet')
  expect(loadout).toContain('href="#/fleet/ships/current/overview">Current ship')
  expect(loadout).toContain('aria-current="page">Loadout')
  expect(loadout).toContain('aria-label="List view"')
  expect(loadout).toContain('title="Switch to grid view"')
  expect(loadout).not.toContain('Current ship views')
  expect(engineering).toContain('Applied blueprints')
  expect(engineering).toContain('No engineered modules observed on the current ship')
  expect(engineering).toContain('aria-current="page">Engineering')
})

test('catalogue selection comes from the typed route', () => {
  const ships = [ship('adder', 'Adder'), ship('python', 'Python')]
  const markup = renderToStaticMarkup(<FleetPage controller={{ catalogue: ships, status: 'ready' }} onNavigate={vi.fn()} route={{ kind: 'information', section: 'fleet', view: 'catalogue', selectedShipId: 'python' }} runtime={{ status: 'loading' }} />)

  expect(markup).toContain('<h2>Python</h2>')
  expect(markup).toContain('Source: Test catalogue · rev-1')
  expect(markup).toContain('aria-selected="true"')
})

function ship(id: string, displayName: string): ShipDefinition {
  return {
    id, displayName, manufacturer: 'Test Works', landingPadSize: 'medium',
    identifiers: { coriolis: id, frontierEdId: null },
    performance: { baseArmour: 100, baseShieldStrength: 50, boost: 300, hullMass: 200, speed: 250 },
    slots: { core: [{ name: 'Power Plant', size: 4 }], hardpoints: [], optional: [], utilities: [] },
    source: { kind: 'catalogue', name: 'Test catalogue', repository: null, revision: 'rev-1' }
  }
}
