import { createEmptyRuntimeState } from '@phoenix/contracts'
import { expect, test } from 'vitest'
import { createDashboardViewModel } from '../apps/web/src/features/dashboard/dashboard-view-model.js'

test('dashboard view model derives commander, situation, ship, route, and notable activity', () => {
  const empty = createEmptyRuntimeState()
  const runtime = {
    ...empty,
    commander: { ...empty.commander, name: 'Ellan Murdock' },
    location: { state: 'docked' as const, place: { kind: 'station' as const, name: 'Locke Terminal', type: null, marketId: null, faction: null, government: null, primaryEconomy: null, economies: [], services: [] } },
    ship: { ...empty.ship, name: 'Type-11 Prospector', identifier: 'EL-06L', hullHealth: 0.86, cargoCapacity: 196, maxJumpRange: 22.4 },
    system: { ...empty.system, name: 'Sol', allegiance: 'Federation', population: 1_000 }
  }
  const model = createDashboardViewModel(
    runtime,
    {
      timestamp: '2026-08-16T12:00:00.000Z',
      route: [
        { system: 'Sol', address: null, position: null, starClass: null },
        { system: 'Achenar', address: null, position: null, starClass: null }
      ]
    },
    [{
      category: 'mission',
      creditDelta: 125000,
      detail: 'Deliver medicines · Galileo, Sol',
      id: 'commander-log-1',
      kind: 'mission.completed',
      schemaVersion: 1,
      sourceEvent: 'MissionCompleted',
      timestamp: '2026-08-16T12:00:00.000Z',
      title: 'Mission completed',
      tone: 'positive'
    }],
    'en-CH'
  )

  expect(model.commander.name).toBe('Ellan Murdock')
  expect(model.situation).toMatchObject({ system: 'Sol', place: 'Locke Terminal', population: "1'000" })
  expect(model.ship).toMatchObject({ name: 'Type-11 Prospector', identifier: 'EL-06L', hull: '86%', jumpRange: '22.4 ly' })
  expect(model.route).toEqual({ current: 'Sol', destination: 'Achenar', detail: '1 jump remaining' })
  expect(model.commanderLog[0]).toMatchObject({
    category: 'Mission',
    detail: 'Deliver medicines · Galileo, Sol',
    title: 'Mission completed',
    value: "+125'000 CR"
  })
})
