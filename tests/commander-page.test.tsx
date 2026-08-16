import { createEmptyRuntimeState } from '@phoenix/contracts'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { CommanderPage } from '../apps/web/src/features/commander/commander-page.js'
import { createCommanderViewModel } from '../apps/web/src/features/commander/commander-view-model.js'
import { commanderNavigationItems } from '../apps/web/src/features/commander/commander-navigation.js'

test('commander family exposes typed contextual destinations', () => {
  expect(commanderNavigationItems.map(item => [item.label, item.href])).toEqual([
    ['Overview', '#/commander/overview'],
    ['Personal stores', '#/commander/inventory'],
    ['Career progress', '#/commander/progress']
  ])
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

  expect(markup).toContain('Personal stores')
  expect(markup).toContain('Ship locker')
  expect(markup).toContain('Backpack')
  expect(markup).toContain('Medkit')
  expect(markup).toContain('healthpack · Stored')
})

test('commander page renders loading and error states without fabricated telemetry', () => {
  const loading = renderToStaticMarkup(<CommanderPage runtime={{ status: 'loading' }} view="overview" />)
  const failed = renderToStaticMarkup(<CommanderPage runtime={{ status: 'error', error: 'Runtime unavailable.' }} view="progress" />)

  expect(loading).toContain('Waiting for commander telemetry')
  expect(loading).not.toContain('Unknown commander')
  expect(failed).toContain('Runtime unavailable.')
  expect(failed).toContain('status-danger')
})
