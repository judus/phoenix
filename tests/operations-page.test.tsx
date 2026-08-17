import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import type { Mission, MissionsResponse } from '@phoenix/contracts'
import { ActivitiesPage } from '../apps/web/src/features/activities/activities-page.js'
import { activitiesNavigationItems } from '../apps/web/src/features/activities/activities-navigation.js'
import { createMissionViewModel } from '../apps/web/src/features/activities/activities-view-model.js'
import { MissionTitle, splitMissionTitle } from '../apps/web/src/features/activities/mission-title.js'

test('Activities exposes the retained information architecture through typed routes', () => {
  expect(activitiesNavigationItems.map(item => [item.label, item.href])).toEqual([
    ['Missions', '#/activities/missions'],
    ['Objectives', '#/activities/objectives'],
    ['Community goals', '#/activities/community-goals'],
    ['Powerplay', '#/activities/powerplay'],
    ['Colonisation', '#/activities/colonisation']
  ])
})

test('mission presentation preserves incomplete evidence and honest unknowns', () => {
  const model = createMissionViewModel(mission())

  expect(model).toMatchObject({
    accepted: 'Not observed',
    destination: 'Sol / Galileo',
    incomplete: true,
    progress: '4 / 12',
    provenance: 'startup-snapshot',
    reward: '—',
    title: 'Delivery'
  })
})

test('mission detail titles promote a colon prefix to an eyebrow', () => {
  expect(splitMissionTitle('Kill Known Pirate: Choochy Greer')).toEqual({
    eyebrow: 'Kill Known Pirate',
    title: 'Choochy Greer'
  })

  const markup = renderToStaticMarkup(<MissionTitle detail value="Kill Known Pirate: Choochy Greer" />)
  expect(markup).toContain('<small>Kill Known Pirate</small><strong>Choochy Greer</strong>')
})

test('mission detail titles without a usable colon remain unchanged', () => {
  expect(splitMissionTitle('Deliver emergency power cells')).toEqual({ title: 'Deliver emergency power cells' })
  expect(splitMissionTitle('Mission:')).toEqual({ title: 'Mission:' })
})

test('Missions composes existing list, status, counter, and detail elements', () => {
  const response = missionsResponse()
  const markup = renderToStaticMarkup(<ActivitiesPage controller={{ missions: response, status: 'ready' }} view="missions" />)

  expect(markup).toContain('1 retained')
  expect(markup).toContain('Rescue Wing · —')
  expect(markup).toContain('Expiry:')
  expect(markup).not.toContain('Mission 42')
  expect(markup).toContain('#/galaxy/system?name=Sol')
  expect(markup).toContain('#/galaxy/system?name=Sol&amp;selected=Galileo')
  expect(markup).toContain('Copy Sol')
  expect(markup).toContain('Copy Galileo')
  expect(markup).toContain('Incomplete acceptance details')
  expect(markup).toContain('This record is intentionally incomplete')
  expect(markup).toContain('startup-snapshot')
  expect(markup).toContain('<dt>Status</dt><dd><span class="status status-information"')
})

test('uncontracted activity views do not fabricate records', () => {
  const markup = renderToStaticMarkup(<ActivitiesPage controller={{ status: 'ready' }} view="colonisation" />)

  expect(markup).toContain('Colonisation ledger')
  expect(markup).toContain('No authoritative colonisation construction record')
  expect(markup).toContain('Select a retained record to inspect its details')
})

function missionsResponse(): MissionsResponse {
  return {
    missions: [mission()],
    summary: { abandoned: 0, active: 1, completed: 0, failed: 0, partial: 1, total: 1, unknown: 0 }
  }
}

function mission(): Mission {
  return {
    acceptedAt: null,
    abandonedAt: null,
    commodity: '$BasicMedicines_Name;',
    commodityCount: 12,
    completedAt: null,
    destinationSettlement: null,
    destinationStation: 'Galileo',
    destinationSystem: 'Sol',
    donated: null,
    donation: null,
    expiry: null,
    faction: 'Rescue Wing',
    failedAt: null,
    id: 42,
    influence: null,
    killCount: null,
    localizedName: null,
    name: 'Mission_Delivery_name',
    passengerCount: null,
    progress: { collected: null, delivered: 4, required: 12 },
    provenance: { acceptanceObserved: false, details: 'partial', snapshotObserved: true, sources: ['startup-snapshot'], terminalObserved: false },
    redirectedAt: null,
    reputation: null,
    reward: null,
    status: 'active',
    statusUpdatedAt: '2026-08-16T12:00:00.000Z',
    target: null,
    targetFaction: null,
    targetType: null,
    updatedAt: '2026-08-16T12:00:00.000Z',
    wing: null
  }
}
