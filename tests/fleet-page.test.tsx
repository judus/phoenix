import { createEmptyRuntimeState } from '@phoenix/contracts'
import type { ShipDefinition } from '@phoenix/contracts'
import { renderToStaticMarkup } from 'react-dom/server'
import { act, create } from 'react-test-renderer'
import { expect, test, vi } from 'vitest'
import { FleetPage } from '../apps/web/src/features/fleet/fleet-page.js'
import { fleetNavigationItems } from '../apps/web/src/features/fleet/fleet-navigation.js'
import { BrowserDevicePreferences } from '../apps/web/src/platform/storage/browser-device-preferences.js'
import { fleetFixture } from './fixtures/fleet-fixture.js'

test('Fleet supplies feature-owned contextual destinations', () => {
  expect(fleetNavigationItems.map(item => [item.label, item.href])).toEqual([
    ['Current ship', '#/fleet/ships/current/overview'],
    ['Overview', '#/fleet/overview'],
    ['Carriers', '#/fleet/carriers'],
    ['Stored modules', '#/fleet/stored-modules'],
    ['Ship catalogue', '#/fleet/catalogue']
  ])
})

test('Fleet overview and current ship render live records without shell chrome', () => {
  const devicePreferences = preferences()
  const overview = renderToStaticMarkup(<FleetPage controller={{ fleet: fleetFixture(), status: 'ready' }} devicePreferences={devicePreferences} onNavigate={vi.fn()} route={{ kind: 'information', section: 'fleet', view: 'overview' }} runtime={{ status: 'loading' }} />)
  const state = { ...createEmptyRuntimeState(), ship: { ...createEmptyRuntimeState().ship, name: 'Prospector', identifier: 'EL-06L' } }
  const current = renderToStaticMarkup(<FleetPage controller={{ status: 'idle' }} devicePreferences={devicePreferences} onNavigate={vi.fn()} route={{ kind: 'information', section: 'fleet', view: 'current-overview' }} runtime={{ status: 'ready', state }} />)
  const loadout = renderToStaticMarkup(<FleetPage controller={{ status: 'idle' }} devicePreferences={devicePreferences} onNavigate={vi.fn()} route={{ kind: 'information', section: 'fleet', view: 'current-loadout' }} runtime={{ status: 'ready', state }} />)
  const engineering = renderToStaticMarkup(<FleetPage controller={{ status: 'idle' }} devicePreferences={devicePreferences} onNavigate={vi.fn()} route={{ kind: 'information', section: 'fleet', view: 'current-engineering' }} runtime={{ status: 'ready', state }} />)

  expect(overview).toContain('Owned vessels')
  expect(overview).toContain('MURDOCK')
  expect(overview).toContain('href="#/galaxy/system?name=Atata"')
  expect(overview).toContain('href="#/galaxy/system?name=Atata&amp;selected=Atata+Hub"')
  expect(overview).toContain('Fleet value')
  expect(overview).toContain('<span class="sort-heading">Vessel</span>')
  expect(overview).toContain('<span class="sort-heading">Transfer cost</span>')
  expect(overview).toContain('<small class="page-status">Updated ')
  expect(overview).not.toContain('<span class="sort-heading">Observed</span>')
  expect(overview).not.toContain('Stored equipment')
  expect(overview).not.toContain('Fleet carriers')
  expect(current).toContain('Prospector')
  expect(current).not.toContain('page-header')
  expect(current).not.toContain('Current ship views')
  expect(current).toContain('aria-label="Current Vessel"')
  expect(current).toContain('<span>Current Vessel</span>')
  expect(current).toContain('<dt>Unladen mass</dt>')
  expect(current).not.toContain('<span>Operational status</span>')
  expect(current).toContain('<span>Integrity</span>')
  expect(current).toContain('<span>Fuel</span>')
  expect(current).toContain('<span>Cargo</span>')
  expect(current).not.toContain('<h3>Current Vessel</h3>')
  expect(current).toContain('Loadout')
  expect(current).toContain('Engineering')
  expect(current).toContain('Target next jump')
  expect(current).toContain('Galaxy map')
  expect(current).toContain('System map')
  expect(current).toContain('Orbit lines')
  expect(current).not.toContain('Flight assist')
  expect(current).toContain('Unbound')
  expect(current).not.toContain('application-shell')
  expect(loadout).toContain('href="#/fleet/overview">Fleet')
  expect(loadout).toContain('href="#/fleet/ships/current/overview">Current ship')
  expect(loadout).toContain('aria-current="page">Loadout')
  expect(loadout).toContain('class="loadout-inventory grid"')
  expect(loadout).toContain('aria-label="Tiles view"')
  expect(loadout).toContain('title="Switch to table view"')
  expect(loadout).not.toContain('Current ship views')
  expect(engineering).toContain('Applied blueprints')
  expect(engineering).toContain('No engineered modules observed on the current ship')
  expect(engineering).toContain('aria-current="page">Engineering')
})

test('Fleet explains missing stored-ship and stored-module snapshots', () => {
  const fleet = fleetFixture()
  const waiting = {
    ...fleet,
    shipsSnapshotAt: null,
    storedModules: { ...fleet.storedModules, details: 'unknown' as const, items: [], snapshotAt: null }
  }
  const devicePreferences = preferences()
  const overview = renderToStaticMarkup(<FleetPage controller={{ fleet: waiting, status: 'ready' }} devicePreferences={devicePreferences} onNavigate={vi.fn()} route={{ kind: 'information', section: 'fleet', view: 'overview' }} runtime={{ status: 'loading' }} />)
  const modules = renderToStaticMarkup(<FleetPage controller={{ fleet: waiting, status: 'ready' }} devicePreferences={devicePreferences} onNavigate={vi.fn()} route={{ kind: 'information', section: 'fleet', view: 'stored-modules' }} runtime={{ status: 'loading' }} />)

  expect(overview).toContain('Open Starport Services → Shipyard')
  expect(modules).toContain('Open Starport Services → Outfitting')
  expect(overview).toContain('href="#/settings/help"')
  expect(modules).toContain('href="#/settings/help"')
})

test('stored modules render a compact manifest with linked record locations', () => {
  const markup = renderToStaticMarkup(<FleetPage controller={{ fleet: fleetFixture(), status: 'ready' }} devicePreferences={preferences()} onNavigate={vi.fn()} route={{ kind: 'information', section: 'fleet', view: 'stored-modules' }} runtime={{ status: 'loading' }} />)

  expect(markup).toContain('Module manifest')
  expect(markup).toContain('1 module · 1 location')
  expect(markup).toContain('href="#/galaxy/system?name=Atata"')
  expect(markup).toContain('href="#/galaxy/system?name=Atata&amp;selected=Atata+Hub"')
  expect(markup).toContain('Purchase value')
  expect(markup).toContain('Dirty Drives G2')
  expect(markup).toContain('5A · Hot')
  expect(markup).not.toContain('$int_engine_size5_class5_name;')
  expect(markup).not.toContain('Storage slot')
  expect(markup).not.toContain('<th>Observed</th>')
})

test('catalogue selection comes from the typed route', () => {
  const ships = [ship('adder', 'Adder'), ship('python', 'Python')]
  const markup = renderToStaticMarkup(<FleetPage controller={{ catalogue: ships, catalogueUpdatedAt: '2026-09-12T22:57:03', status: 'ready' }} devicePreferences={preferences()} onNavigate={vi.fn()} route={{ kind: 'information', section: 'fleet', view: 'catalogue', selectedShipId: 'python' }} runtime={{ status: 'loading' }} />)

  expect(markup).toContain('<h2>Python</h2>')
  expect(markup).toContain('Updated <time dateTime="2026-09-12T22:57:03">12 Sept 3312, 22:57</time>')
  expect(markup).not.toContain('Source: Test catalogue')
  expect(markup).toContain('aria-selected="true"')
  expect(markup).toContain('aria-label="Dossier view"')
  expect(markup).toContain('title="Switch to table view"')
})

test('Fleet persists loadout and catalogue view choices in device preferences', async () => {
  const devicePreferences = preferences()
  const state = createEmptyRuntimeState()
  const renderer = await act(async () => create(<FleetPage
    controller={{ status: 'idle' }}
    devicePreferences={devicePreferences}
    onNavigate={vi.fn()}
    route={{ kind: 'information', section: 'fleet', view: 'current-loadout' }}
    runtime={{ status: 'ready', state }}
  />))

  expect(renderer.root.findByProps({ 'aria-label': 'Tiles view' }).props.title).toBe('Switch to table view')
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Tiles view' }).props.onClick())
  expect(devicePreferences.getSnapshot().currentShipLoadoutView).toBe('table')
  expect(renderer.root.findByProps({ 'aria-label': 'Table view' }).props.title).toBe('Switch to tiles view')

  await act(async () => renderer.update(<FleetPage
    controller={{ catalogue: [ship('adder', 'Adder')], status: 'ready' }}
    devicePreferences={devicePreferences}
    onNavigate={vi.fn()}
    route={{ kind: 'information', section: 'fleet', view: 'catalogue' }}
    runtime={{ status: 'loading' }}
  />))
  await act(async () => renderer.root.findByProps({ 'aria-label': 'Dossier view' }).props.onClick())
  expect(devicePreferences.getSnapshot().shipCatalogueView).toBe('table')
  expect(renderer.root.findByProps({ 'aria-label': 'Table view' }).props.title).toBe('Switch to dossier view')
  expect(renderer.root.findByProps({ className: 'table-region table-scroll' })).toBeDefined()

  await act(async () => renderer.unmount())
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

function preferences(): BrowserDevicePreferences {
  return new BrowserDevicePreferences(new MemoryStorage())
}

class MemoryStorage {
  private readonly values = new Map<string, string>()
  public getItem (key: string): string | null { return this.values.get(key) ?? null }
  public setItem (key: string, value: string): void { this.values.set(key, value) }
}
