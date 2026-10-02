import { expect, test } from 'vitest'
import { createEmptyRuntimeState, type ShipModule } from '@phoenix/contracts'
import { copilotModuleName, RuntimeContextRenderer } from '@phoenix/copilot'
import { ShipListModulesTool } from '../apps/server/src/application/mcp-tools/ship-list-modules-tool.js'

function module(id: string, name: string, size: number, rating: string, slot = 'Slot03_Size5'): ShipModule {
  return {
    slotId: slot, slotGroup: 'optional', slotSize: 5, expectedSlot: null,
    moduleId: id, moduleSize: size || null, moduleClass: 1,
    definition: { journalId: id, displayName: name, category: 'internal', size, rating,
      mount: null, guidance: null, ship: null,
      source: { kind: 'catalogue', name: 'Fixture', repository: null, revision: null } },
    enabled: true, priority: 0, health: 1, value: null, ammo: null, engineering: null
  }
}
const hangar = () => module('int_fighterbay_size5_class1', 'Vessel Hangar', 5, 'D')
function stateWithModules() {
  const state = createEmptyRuntimeState()
  state.ship.typeId = 'krait_mkii'
  state.ship.modules = [hangar(), ...['VesselVoice', 'ShipCockpit', 'CargoHatch'].map(slotId => ({
    ...module(slotId.toLowerCase(), slotId, 1, 'E', slotId), slotGroup: 'ship' as const
  }))]
  return state
}

test('runtime prompt exposes the actual fighter hangar and omits built-in journal components', () => {
  const state = stateWithModules()
  const rendered = new RuntimeContextRenderer().render(state)
  expect(rendered).toContain('5D Vessel Hangar (slot: Slot03_Size5')
  expect(rendered).toContain('carries ship-launched fighters; not an SRV hangar')
  expect(rendered).not.toContain('Planetary Vehicle Hangar')
  for (const name of ['VesselVoice', 'ShipCockpit', 'CargoHatch']) expect(rendered).not.toContain(name)
  expect(state.ship.modules).toHaveLength(4)
})

test('SRV hangars retain their separate catalogue name and role', () => {
  const state = createEmptyRuntimeState()
  state.ship.modules = [hangar(), module('int_buggybay_size2_class1', 'Planetary Vehicle Hangar', 2, 'H', 'Slot08_Size2')]
  const text = new RuntimeContextRenderer().render(state)
  expect(text).toContain('5D Vessel Hangar')
  expect(text).toContain('2H Planetary Vehicle Hangar')
  expect(text).toContain('carries surface vehicles (SRVs); not a fighter hangar')
})

test('module tool excludes infrastructure by default, retains diagnostic access and reports truncation', () => {
  const state = stateWithModules()
  state.ship.modules.unshift(...Array.from({ length: 23 }, (_, i) => module(`int_fixture_${i}`, 'Fixture module', 1, 'E', `Slot${i}`)))
  const tool = new ShipListModulesTool({ getCurrent: () => state })
  const all = tool.execute({})
  expect(all.structuredContent).toMatchObject({ available: true, matched: 24, returned: 24, truncated: false })
  expect(JSON.stringify(all)).toContain('5D Vessel Hangar')
  expect(JSON.stringify(all)).not.toContain('VesselVoice')
  expect(tool.execute({ limit: 1 }).structuredContent).toMatchObject({ matched: 24, returned: 1, truncated: true })
  expect(tool.execute({ category: 'ship' }).structuredContent).toMatchObject({ matched: 3 })
  expect(tool.execute({ query: 'Vessel Hangar' }).structuredContent).toMatchObject({ matched: 1 })
})

test('unknown names and ratings are not invented, and missing loadout is explicitly unavailable', () => {
  const unknown = { ...hangar(), definition: null }
  expect(copilotModuleName(unknown)).toBe('Unidentified module (journal identifier: int_fighterbay_size5_class1)')
  expect(copilotModuleName(module('int_shieldbooster_size0_class5', 'Shield Booster', 0, 'A'))).toBe('0A Shield Booster')
  const state = createEmptyRuntimeState()
  expect(new RuntimeContextRenderer().render(state)).toContain('Loadout unavailable')
  expect(new ShipListModulesTool({ getCurrent: () => state }).execute({}).structuredContent).toMatchObject({ available: false })
})
