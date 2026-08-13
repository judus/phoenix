import { expect, test } from 'vitest'
import { resolveNumpadLevel, type NumpadTreeSnapshot } from '@phoenix/contracts'

const snapshot = tree([
  node('one', '1'),
  node('ten', '10'),
  node('eleven', '11')
])

test('a selector remains ambiguous while longer sibling selectors exist', () => {
  expect(resolveNumpadLevel(snapshot, null, '1')).toMatchObject({
    status: 'ambiguous',
    exact: { id: 'one' },
    hasLongerMatches: true
  })
})

test('a unique complete selector is immediately ready', () => {
  expect(resolveNumpadLevel(snapshot, null, '11')).toMatchObject({
    status: 'ready',
    exact: { id: 'eleven' },
    hasLongerMatches: false
  })
})

function node (id: string, selector: string) {
  return {
    address: selector,
    available: true,
    id,
    kind: 'navigation' as const,
    label: id,
    parentId: null,
    risk: 'safe' as const,
    selector,
    target: { type: 'navigation' as const, destinationId: id }
  }
}

function tree (nodes: NumpadTreeSnapshot['nodes']): NumpadTreeSnapshot {
  return {
    activationDigit: '0',
    diagnostics: [],
    generatedAt: '2026-08-14T00:00:00.000Z',
    nodes,
    revision: 1
  }
}
