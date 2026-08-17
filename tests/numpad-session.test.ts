import { expect, test } from 'vitest'
import type { NumpadTreeSnapshot } from '@phoenix/contracts'
import {
  activateNumpadSession,
  confirmNumpadSelection,
  enterNumpadDigit,
  finishNumpadSession,
  selectNumpadNode
} from '../apps/web/src/features/numpad/numpad-session.js'

const snapshot: NumpadTreeSnapshot = {
  activationDigit: '0',
  diagnostics: [],
  generatedAt: '2026-08-14T00:00:00.000Z',
  revision: 1,
  nodes: [
    node('controls', null, '1', '1', null),
    node('first', 'controls', '1', '11', { type: 'navigation', destinationId: 'first' }),
    node('eleven', 'controls', '11', '111', { type: 'navigation', destinationId: 'eleven' })
  ]
}

test('selecting a branch descends into its children', () => {
  const result = enterNumpadDigit(snapshot, activateNumpadSession().state, '1', false)
  expect(result.execute).toBeUndefined()
  expect(result.state).toMatchObject({ pathIds: ['controls'], pendingDigits: '', status: 'browsing' })
})

test('ambiguous keyboard input waits but Enter executes its exact match', () => {
  const branch = enterNumpadDigit(snapshot, activateNumpadSession().state, '1', false).state
  const ambiguous = enterNumpadDigit(snapshot, branch, '1', false)
  expect(ambiguous.execute).toBeUndefined()
  expect(ambiguous.state.status).toBe('ambiguous')

  const confirmed = confirmNumpadSelection(snapshot, ambiguous.state)
  expect(confirmed.execute?.id).toBe('first')
})

test('always-confirm mode waits for Enter even for a unique leaf', () => {
  const branch = enterNumpadDigit(snapshot, activateNumpadSession().state, '1', false).state
  let transition = enterNumpadDigit(snapshot, branch, '1', true)
  transition = enterNumpadDigit(snapshot, transition.state, '1', true)
  expect(transition.execute).toBeUndefined()
  expect(transition.state.status).toBe('ready')
  expect(confirmNumpadSelection(snapshot, transition.state).execute?.id).toBe('eleven')
})

test('tile selection addresses the exact node without prefix ambiguity', () => {
  const branch = enterNumpadDigit(snapshot, activateNumpadSession().state, '1', false).state
  expect(selectNumpadNode(snapshot, branch, 'first', false).execute?.id).toBe('first')
})

test('an empty menu still opens instead of being treated as an unavailable command', () => {
  const emptyMenuSnapshot: NumpadTreeSnapshot = {
    ...snapshot,
    nodes: [node('shortcuts', null, '9', '9', null)]
  }
  const result = enterNumpadDigit(emptyMenuSnapshot, activateNumpadSession().state, '9', false)
  expect(result.state).toMatchObject({ pathIds: ['shortcuts'], status: 'browsing' })
})

test('a finished execution clears its address and ends the active session', () => {
  const branch = enterNumpadDigit(snapshot, activateNumpadSession().state, '1', false).state
  const executing = confirmNumpadSelection(snapshot, enterNumpadDigit(snapshot, branch, '1', false).state).state
  const completed = finishNumpadSession(executing, 'completed', 'Command accepted.')

  expect(completed).toMatchObject({ active: false, pathIds: [], pendingDigits: '', status: 'completed' })
})

test('keyboard input remains bounded when no selector matches', () => {
  let state = activateNumpadSession().state
  for (const digit of ['8', '8', '8', '8']) state = enterNumpadDigit(snapshot, state, digit, false).state

  expect(state).toMatchObject({ pendingDigits: '888', status: 'invalid' })
})

function node (
  id: string,
  parentId: string | null,
  selector: string,
  address: string,
  target: NumpadTreeSnapshot['nodes'][number]['target']
): NumpadTreeSnapshot['nodes'][number] {
  return {
    address,
    available: true,
    id,
    kind: target ? 'navigation' : 'menu',
    label: id,
    parentId,
    risk: 'safe',
    selector,
    target
  }
}
