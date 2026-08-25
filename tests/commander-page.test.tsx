import { createEmptyRuntimeState } from '@phoenix/contracts'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { CommanderPage } from '../apps/web/src/features/commander/commander-page.js'
import { createCommanderViewModel } from '../apps/web/src/features/commander/commander-view-model.js'
import { commanderNavigationItems } from '../apps/web/src/features/commander/commander-navigation.js'

test('commander family exposes typed contextual destinations', () => {
  expect(commanderNavigationItems.map(item => [item.label, item.href])).toEqual([
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

  expect(career).toContain('commander-career-dashboard')
  expect(career).toContain('commander-career-rows')
  expect(career).toContain('commander-naval-ranks')
  expect(career).toContain('commander-standing-grid')
  expect(career).toContain('Total credits')
  expect(career).toContain('Legal status')
  expect(career).toContain('>Notoriety</dt>')
  expect(career).toContain('aria-label="Commander notoriety" max="10" value="3"')
  expect(career).toContain('Career dashboard for CMDR Muirn')
  expect(career).not.toContain('Commander</a></li><li><span aria-current="page">Career')
  expect(career).toContain('commander-rank-card')
  expect(career).toContain('commander-reputation-card')
  expect(career).not.toContain('commander-progress')
  expect(career).not.toContain('Progress toward the next rank')
  expect(career).not.toContain('Federation and Empire auxiliary progression')
  expect(career).not.toContain("Standing reported on Frontier's")
  expect(career).toContain('+92%')
  expect(career).toContain('Allied')
  expect(career).toContain('CMDR Muirn')
  expect(career).not.toContain('Current situation')
  expect(statistics).toContain('Lifetime Statistics')
  expect(statistics).toContain('Commander</a></li><li><span aria-current="page">Lifetime Statistics')
  expect(statistics).toContain('<h1>Lifetime Statistics</h1>')
  expect(statistics).toContain('Reported ')
  expect(statistics.match(/commander-statistics-column/g)).toHaveLength(2)
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
  expect(markup).toContain('Commander</a></li><li><span aria-current="page">Personal Stores')
  expect(markup).toContain('<h1>Personal Stores</h1>')
  expect(markup).toContain('auto-grid grid-xl gap-xl commander-stores')
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
