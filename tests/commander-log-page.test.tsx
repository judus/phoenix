import { renderWithAct } from './support/render-with-act.js'
import { act, create } from 'react-test-renderer'
import { renderToStaticMarkup } from 'react-dom/server'
import { ItemListItem } from '@phoenix/ui'
import { beforeAll, expect, test, vi } from 'vitest'
import { CommanderLogPage } from '../apps/web/src/features/journal/commander-log-page.js'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../apps/web/src/application/events/phoenix-event-hub.js'
import { developerNavigationItems, journalNavigationItems } from '../apps/web/src/features/journal/journal-navigation.js'
import { utilityItems, workspaceItems } from '../apps/web/src/components/shell/navigation-model.js'
import { DEFAULT_ROUTE } from '../apps/web/src/application/navigation/phoenix-route.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('player history supports loading more and filtering without showing raw payloads', async () => {
  const entries = Array.from({ length: 60 }, (_, index) => ({
    id: String(index), schemaVersion: 1, timestamp: '2026-09-28T10:00:00Z',
    category: index === 0 ? 'exploration' : 'engineering', kind: 'engineering.materials_traded',
    title: index === 0 ? 'Biological analysis completed' : 'Materials traded',
    detail: index === 0 ? 'Fonticulua Fluctus' : 'Conductive Polymers',
    creditDelta: null, tone: 'positive', sourceEvent: 'MaterialTrade'
  }))
  const api = { getCommanderLog: vi.fn().mockResolvedValue({ entries }) } as unknown as PhoenixApi
  const unsubscribe = vi.fn()
  const events = { subscribe: vi.fn(() => unsubscribe) } as unknown as PhoenixEventHub
  const renderer = await renderWithAct(<CommanderLogPage api={api} events={events} />)
  const rows = () => renderer.root.findAllByType(ItemListItem)
  expect(rows()).toHaveLength(50)
  await act(async () => renderer.root.findByType('button').props.onClick())
  expect(rows()).toHaveLength(60)
  await act(async () => renderer.root.findByType('select').props.onChange({ target: { value: 'exploration' } }))
  expect(rows()).toHaveLength(1)
  expect(JSON.stringify(renderer.toJSON())).toContain('Fonticulua Fluctus')
  await act(async () => renderer.root.findByType('input').props.onChange({ target: { value: 'nothing' } }))
  expect(rows()).toHaveLength(0)
  expect(JSON.stringify(renderer.toJSON())).toContain('No matching log entries')
  await act(async () => renderer.unmount())
  expect(unsubscribe).toHaveBeenCalledOnce()
})

test('commander history uses the shared header and breadcrumb navigation', () => {
  const api = { getCommanderLog: vi.fn() } as unknown as PhoenixApi
  const events = { subscribe: vi.fn() } as unknown as PhoenixEventHub
  const markup = renderToStaticMarkup(<CommanderLogPage api={api} events={events} />)
  expect(markup).toContain('class="page-header page-header-cockpit"')
  expect(markup).toContain('aria-label="Breadcrumb"')
  expect(markup).toContain('class="breadcrumb-separator"')
  expect(markup).toContain('<span>Log</span>')
  expect(markup).toContain('<span aria-current="page">Commander</span>')
  expect(markup).not.toContain('Log · Commander')
})

test('LOG has Notes first and optional DEV follows STG in workspace navigation', () => {
  const items = utilityItems({ active: false, supported: true })
  expect(items.find(item => item.id === 'journal')).toBeUndefined()
  const workspaces = workspaceItems(DEFAULT_ROUTE)
  expect(workspaces.map(item => item.shortLabel)).toEqual(['CTR', 'INF', 'LOG', 'CPT', 'STG'])
  expect(items.find(item => item.id === 'settings')).toBeUndefined()
  expect(workspaces.at(-1)).toMatchObject({ id: 'settings', href: '#/settings/general' })
  expect(workspaces.find(item => item.id === 'journal')).toMatchObject({ href: '#/notes' })
  expect(items.find(item => item.id === 'developer')).toBeUndefined()
  expect(workspaceItems(DEFAULT_ROUTE, undefined, undefined, undefined, { showDeveloper: true }).at(-1))
    .toMatchObject({ shortLabel: 'DEV', href: '#/developer/tools' })
  expect(journalNavigationItems.map(item => item.shortLabel)).toEqual(['NTS', 'CMD', 'CRD'])
  expect(developerNavigationItems.map(item => item.shortLabel)).toEqual(['JRN', 'TLS', 'EDDN'])
})
