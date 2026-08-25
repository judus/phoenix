import { createEmptyRuntimeState } from '@phoenix/contracts'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { CommanderPage } from '../apps/web/src/features/commander/commander-page.js'
import { createCommanderViewModel } from '../apps/web/src/features/commander/commander-view-model.js'
import { commanderNavigationItems } from '../apps/web/src/features/commander/commander-navigation.js'

test('commander family exposes typed contextual destinations', () => {
  expect(commanderNavigationItems.map(item => [item.label, item.href])).toEqual([
    ['Career', '#/commander/career'],
    ['Statistics', '#/commander/statistics'],
    ['Personal stores', '#/commander/inventory']
  ])
})

test('commander career and statistics expose unique commander records', () => {
  const empty = createEmptyRuntimeState()
  const state = {
    ...empty,
    commander: {
      ...empty.commander,
      name: 'Muirn',
      ranks: { ...empty.commander.ranks, exploration: 7 },
      rankProgress: { ...empty.commander.rankProgress, exploration: 61 },
      reputation: { ...empty.commander.reputation, federation: 92 },
      statistics: {
        updatedAt: '2026-08-16T12:00:00.000Z',
        groups: { Exploration: { Systems_Visited: 412 } }
      }
    }
  }
  const model = createCommanderViewModel(state)
  const career = renderToStaticMarkup(<CommanderPage model={model} runtime={{ status: 'ready', state }} view="career" />)
  const statistics = renderToStaticMarkup(<CommanderPage model={model} runtime={{ status: 'ready', state }} view="statistics" />)

  expect(career).toContain('Career ranks')
  expect(career).toContain('Galactic reputation')
  expect(career).toContain('progress toward the next rank')
  expect(career).toContain('+92%')
  expect(career).toContain('Allied')
  expect(career).toContain('CMDR Muirn')
  expect(career).not.toContain('Current situation')
  expect(statistics).toContain('Lifetime Statistics')
  expect(statistics).toContain('Commander</a></li><li><span aria-current="page">Lifetime Statistics')
  expect(statistics).toContain('Reported ')
  expect(statistics).toContain('Systems Visited')
  expect(statistics).toContain('412')
})

test('commander inventory renders accepted personal-store structure from runtime state', () => {
  const empty = createEmptyRuntimeState()
  const state = {
    ...empty,
    commander: { ...empty.commander, name: 'Muirn' },
    inventory: {
      ...empty.inventory,
      backpack: {
        updatedAt: '2026-08-16T12:00:00.000Z',
        items: [],
        components: [],
        consumables: [{ id: 'healthpack', label: 'Medkit', count: 7, ownerId: null, missionId: null }],
        data: []
      }
    }
  }
  const markup = renderToStaticMarkup(
    <CommanderPage
      model={createCommanderViewModel(state)}
      runtime={{ status: 'ready', state }}
      view="inventory"
    />
  )

  expect(markup).toContain('Personal Stores')
  expect(markup).toContain('Ship locker')
  expect(markup).toContain('Backpack')
  expect(markup).toContain('Medkit')
  expect(markup).toContain('healthpack · Stored')
})

test('commander page renders loading and error states without fabricated telemetry', () => {
  const loading = renderToStaticMarkup(<CommanderPage runtime={{ status: 'loading' }} view="career" />)
  const failed = renderToStaticMarkup(<CommanderPage runtime={{ status: 'error', error: 'Runtime unavailable.' }} view="statistics" />)

  expect(loading).toContain('Waiting for commander telemetry')
  expect(loading).not.toContain('Unknown commander')
  expect(failed).toContain('Runtime unavailable.')
  expect(failed).toContain('status-danger')
})
