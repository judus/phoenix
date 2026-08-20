import { expect, test } from 'vitest'
import {
  activateControlDeckNumpadSession,
  aggregateControlDeckNumpadTrees,
  confirmControlDeckNumpadSelection,
  controlDeckNumpadContribution,
  enterControlDeckNumpadDigit,
  enterControlDeckNumpadDigitOrCancel,
  selectControlDeckNumpadNode
} from '@jdu/control-deck-core'

const tree = aggregateControlDeckNumpadTrees([{
  id: 'fixture',
  nodes: [
    { id: 'deck', parentId: null, selector: '1', label: 'Deck', available: true, action: null },
    { id: 'subdeck', parentId: 'deck', selector: '1', label: '01', available: true, action: { type: 'navigation', destinationId: 'deck:01' } },
    { id: 'one', parentId: 'subdeck', selector: '1', label: 'One', available: true, action: { type: 'navigation', destinationId: 'one' } },
    { id: 'ten', parentId: 'subdeck', selector: '10', label: 'Ten', available: true, action: { type: 'navigation', destinationId: 'ten' } }
  ]
}])

test('numpad entry descends deck and subdeck levels before resolving a button', () => {
  let transition = enterControlDeckNumpadDigit(tree, activateControlDeckNumpadSession(), '1')
  expect(transition.state.pathIds).toEqual(['fixture:deck'])
  transition = enterControlDeckNumpadDigit(tree, transition.state, '1')
  expect(transition).toMatchObject({ action: { type: 'navigation', destinationId: 'deck:01' }, state: { pathIds: ['fixture:deck', 'fixture:subdeck'] } })
  transition = enterControlDeckNumpadDigit(tree, transition.state, '1')
  expect(transition.action).toBeUndefined()
  expect(transition.state.status).toBe('ambiguous')
  expect(confirmControlDeckNumpadSelection(tree, transition.state).action).toEqual({ type: 'navigation', destinationId: 'one' })
})

test('zero completes a valid multi-digit selector and otherwise cancels', () => {
  let state = enterControlDeckNumpadDigit(tree, activateControlDeckNumpadSession(), '1').state
  state = enterControlDeckNumpadDigit(tree, state, '1').state
  state = enterControlDeckNumpadDigit(tree, state, '1').state
  expect(enterControlDeckNumpadDigitOrCancel(tree, state, '0').action).toEqual({ type: 'navigation', destinationId: 'ten' })
  expect(enterControlDeckNumpadDigitOrCancel(tree, activateControlDeckNumpadSession(), '0').state.active).toBe(false)
})

test('tile selection bypasses numeric prefix ambiguity', () => {
  let state = enterControlDeckNumpadDigit(tree, activateControlDeckNumpadSession(), '1').state
  state = enterControlDeckNumpadDigit(tree, state, '1').state
  expect(selectControlDeckNumpadNode(tree, state, 'fixture:one').action).toEqual({ type: 'navigation', destinationId: 'one' })
})

test('the built-in contribution preserves deck grid positions as button selectors', () => {
  const contribution = controlDeckNumpadContribution({
    version: 1,
    groups: [{ id: 'ship', name: 'Ship', description: '' }],
    decks: [{
      id: 'ship_01', groupId: 'ship', name: '01', description: '', context: null,
      layout: { kind: 'grid', columns: 4, rows: 3 },
      elements: [{
        id: 'fire', kind: 'command', target: { adapterId: 'builtin.keyboard', commandId: 'key', configuration: { key: 'Space' } },
        placement: { kind: 'grid', column: 2, row: 3, columnSpan: 1, rowSpan: 1 },
        appearance: { label: 'Fire', icon: null, foregroundColor: null, backgroundColor: null },
        interaction: { activation: 'tap', confirmation: { kind: 'none' } }
      }]
    }],
    displays: []
  })
  expect(contribution.nodes.find(node => node.id.includes('button'))).toMatchObject({ selector: '10', position: 10, label: 'Fire' })
})

test('tree aggregation rejects selector collisions between injected contributors', () => {
  expect(() => aggregateControlDeckNumpadTrees([
    { id: 'one', nodes: [{ id: 'root', parentId: null, selector: '1', label: 'One', action: null, available: true }] },
    { id: 'two', nodes: [{ id: 'root', parentId: null, selector: '1', label: 'Two', action: null, available: true }] }
  ])).toThrow(/selector collision/u)
})

test('a protected button waits for explicit confirmation', () => {
  const protectedTree = aggregateControlDeckNumpadTrees([{
    id: 'protected',
    nodes: [{ id: 'danger', parentId: null, selector: '1', label: 'Danger', available: true, confirm: true, action: { type: 'navigation', destinationId: 'danger' } }]
  }])
  const pending = enterControlDeckNumpadDigit(protectedTree, activateControlDeckNumpadSession(), '1')
  expect(pending.action).toBeUndefined()
  expect(pending.state).toMatchObject({ status: 'ready', message: 'Press Enter to execute.' })
  expect(confirmControlDeckNumpadSelection(protectedTree, pending.state).action).toEqual({ type: 'navigation', destinationId: 'danger' })
})
