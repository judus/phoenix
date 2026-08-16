import { expect, test } from 'vitest'
import { DeskplaneRouteSynchronizer } from '../apps/web/src/components/shell/deskplane-route-synchronizer.js'

test('programmatic Deskplane movement cannot feed navigation back into the router', () => {
  const synchronizer = new DeskplaneRouteSynchronizer('info')

  synchronizer.beginRouteSynchronization('settings')
  expect(synchronizer.receiveDeskplaneSnapshot('developer')).toBeUndefined()
  expect(synchronizer.receiveDeskplaneSnapshot('settings')).toBeUndefined()
  synchronizer.finishRouteSynchronization('settings')

  expect(synchronizer.receiveDeskplaneSnapshot('info')).toBe('info')
  expect(synchronizer.receiveDeskplaneSnapshot('info')).toBeUndefined()
})

test('unknown Deskplane destinations never reach the typed router boundary', () => {
  const synchronizer = new DeskplaneRouteSynchronizer('info')
  expect(synchronizer.receiveDeskplaneSnapshot('unknown')).toBeUndefined()
})
