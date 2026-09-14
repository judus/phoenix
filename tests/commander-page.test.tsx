import { createEmptyRuntimeState } from '@phoenix/contracts'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { CommanderPage } from '../apps/web/src/features/commander/commander-page.js'
import { createCommanderViewModel } from '../apps/web/src/features/commander/commander-view-model.js'
import { commanderNavigationItems } from '../apps/web/src/features/commander/commander-navigation.js'

test('commander family exposes typed contextual destinations', () => {
  expect(commanderNavigationItems.map(item => [item.label, item.href])).toEqual([
    ['Command dashboard', '#/commander/dashboard'],
    ['Career', '#/commander/career'],
    ['Personal stores', '#/commander/inventory'],
    ['Statistics', '#/commander/statistics']
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
        groups: {
          Exploration: { Systems_Visited: 412 },
          Combat: { Bounties_Claimed: 17 },
          Bank_Account: { Current_Wealth: 148827050 },
          Crime: { Notoriety: 3 }
        }
      }
    }
  }
  const model = createCommanderViewModel(state)
  const career = renderToStaticMarkup(<CommanderPage model={model} runtime={{ status: 'ready', state }} view="career" />)
  const statistics = renderToStaticMarkup(<CommanderPage model={model} runtime={{ status: 'ready', state }} view="statistics" />)

  expect(career).toContain('href="#/commander/career">Commander</a>')
  expect(career).toContain('<span aria-current="page">Career</span>')
  expect(career).toContain('<h1>Career</h1>')
  expect(career).toContain('<h2>Pilots Federation ranks</h2>')
  expect(career).toContain('<thead><tr><th>Career</th><th>Rank</th><th class="numeric">Progress</th>')
  expect(career).toContain('<strong>Exploration</strong>')
  expect(career).toContain('<td>Pioneer</td>')
  expect(career).toContain('<td class="numeric">61%</td>')
  expect(career).toContain('<h2>Superpowers</h2>')
  expect(career).toContain('<th>Power</th><th>Naval rank</th>')
  expect(career).toContain('<strong>Federation</strong>')
  expect(career).toContain('+92%')
  expect(career).toContain('Allied')
  expect(career).not.toContain('meter')
  expect(career).not.toContain('Credits')
  expect(career).not.toContain('Legal status')
  expect(statistics).toContain('Lifetime Statistics')
  expect(statistics).toContain('href="#/commander/career">Commander</a>')
  expect(statistics).toContain('<span aria-current="page">Lifetime Statistics</span>')
  expect(statistics).toContain('<h1>Lifetime Statistics</h1>')
  expect(statistics).toContain('Updated ')
  expect(statistics.match(/commander-statistics-column/g)).toHaveLength(2)
  expect(statistics).toContain('<thead><tr><th>Record</th><th class="numeric">Value</th>')
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
  expect(markup).toContain('href="#/commander/career">Commander</a>')
  expect(markup).toContain('<span aria-current="page">Personal Stores</span>')
  expect(markup).toContain('<h1>Personal Stores</h1>')
  expect(markup).toContain('auto-grid grid-xl gap-xl commander-stores')
  expect(markup).toContain('Ship locker')
  expect(markup).toContain('Backpack')
  expect(markup).toContain('<thead><tr><th>Consumables</th><th class="numeric">7</th></tr></thead>')
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
