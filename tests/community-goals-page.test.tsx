import { act } from 'react-test-renderer'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeAll, expect, test } from 'vitest'
import type { CommunityGoalsResponse } from '@phoenix/contracts'
import { ActivitiesPage } from '../apps/web/src/features/activities/activities-page.js'
import { renderWithAct } from './support/render-with-act.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

const response: CommunityGoalsResponse = {
  cache: 'refreshed', fetchedAt: '2026-10-07T12:00:00.000Z', goals: [{
    id: '1', title: 'Research supplies', systemName: 'Sol', stationName: 'Galileo', activityType: 'trade',
    objective: 'Deliver supplies', targetCommodities: 'Basic Medicines', contributed: 125, target: 1000,
    expiry: '2026-10-08 10:00:00', briefing: 'Sign up first.\nDeliver supplies.\n<script>not executable</script>'
  }, {
    id: '2', title: 'Combat initiative', systemName: 'Achenar', stationName: 'Dawes Hub', activityType: 'combatbond',
    objective: 'Combat bonds', targetCommodities: 'Combat bonds', contributed: 1500, target: 1000,
    expiry: '2026-10-09 10:00:00', briefing: 'Fight for the initiative.'
  }]
}

test('goals show authoritative progress, escaped briefing and destination links without invented personal stats', () => {
  const markup = renderToStaticMarkup(<ActivitiesPage view="community-goals" controller={{ status: 'ready', communityGoals: response }} />)
  expect(markup).toContain('12.5% · 125 / 1,000')
  expect(markup).toContain('3312-10-08 10:00')
  expect(markup).toContain('Expiry (Frontier time)')
  expect(markup).toContain('dateTime="2026-10-08T10:00:00"')
  expect(markup).toContain('#/galaxy/system?name=Sol&amp;selected=Galileo')
  expect(markup).toContain('&lt;script&gt;not executable&lt;/script&gt;')
  expect(markup).not.toContain('<script>')
  expect(markup).not.toContain('Your contribution')
  expect(markup).not.toContain('Reward tier')
})

test('keyboard selection changes briefing and removed selection falls back to the remaining goal', async () => {
  const render = (data: CommunityGoalsResponse) => <ActivitiesPage view="community-goals" controller={{ status: 'ready', communityGoals: data }} />
  const renderer = await renderWithAct(render(response))
  const second = renderer.root.findByProps({ 'aria-label': 'Community Goals' }).findAllByType('li')[1]!
  const prevented: string[] = []
  await act(async () => second.props.onKeyDown({ key: 'Enter', preventDefault: () => prevented.push('yes') }))
  expect(prevented).toEqual(['yes'])
  expect(renderer.root.findByProps({ 'aria-label': 'Official briefing' }).findByType('p').children).toEqual(['Fight for the initiative.'])
  expect(renderer.root.findByType('progress').props.value).toBe(100)
  expect(renderer.root.findByType('output').children).toContain('150.0% · 1,500 / 1,000')
  await act(async () => renderer.update(render({ ...response, goals: [response.goals[0]!] })))
  expect(renderer.root.findByProps({ 'aria-label': 'Official briefing' }).findAllByType('p')[0]!.children).toEqual(['Sign up first.'])
  await act(async () => renderer.unmount())
})

test('loading, cold failure, authoritative empty and stale empty are different states', () => {
  const markup = (controller: Parameters<typeof ActivitiesPage>[0]['controller']) =>
    renderToStaticMarkup(<ActivitiesPage view="community-goals" controller={controller} />)
  expect(markup({ status: 'loading' })).toContain('Loading Community Goals')
  expect(markup({ status: 'error', error: 'Frontier unavailable' })).toContain('Frontier unavailable')
  expect(markup({ status: 'error', error: 'Frontier unavailable' })).not.toContain('lists no Community Goals')
  expect(markup({ status: 'ready', communityGoals: { ...response, goals: [] } })).toContain('Frontier currently lists no Community Goals')
  const stale = markup({ status: 'ready', communityGoals: { ...response, cache: 'stale', goals: [] } })
  expect(stale).toContain('Frontier refresh failed')
  expect(stale).toContain('No goals were listed in the last saved Frontier response')
  expect(stale).not.toContain('Frontier currently lists no Community Goals')
})
