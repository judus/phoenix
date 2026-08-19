import { expect, test } from 'vitest'
import {
  CommandCatalogueSnapshotSchema,
  CommandExecutionResultSchema,
  ControlGridLayoutSchema,
  NumpadTreeSnapshotSchema,
  resolveNumpadLevel
} from '@phoenix/control-deck'

test('command results keep host-specific outcomes behind generic effects', () => {
  const result = CommandExecutionResultSchema.parse({
    requestId: 'request-1',
    correlationId: 'correlation-1',
    commandId: 'navigation.settings',
    operation: 'tap',
    origin: 'ui',
    status: 'accepted',
    timestamp: '2026-08-19T12:00:00.000Z',
    message: 'Open settings.',
    effects: [{ type: 'navigate', payload: { href: '/settings' } }]
  })

  expect(result.effects).toEqual([{ type: 'navigate', payload: { href: '/settings' } }])
})

test('command catalogue snapshots reject duplicate stable identities', () => {
  const command = {
    available: true,
    groupId: 'test',
    id: 'test.command',
    kind: 'test',
    label: 'Test command',
    recordable: true,
    risk: 'safe' as const,
    supportedOperations: ['tap' as const]
  }

  expect(() => CommandCatalogueSnapshotSchema.parse({
    commands: [command, command],
    generatedAt: '2026-08-19T00:00:00.000Z',
    revision: 1
  })).toThrow('Duplicate command id')
})

test('control deck layouts reject overlapping cells', () => {
  expect(() => ControlGridLayoutSchema.parse({
    pages: [{
      cells: [
        { commandId: 'test.first', position: 1, span: 2 },
        { commandId: 'test.second', position: 2, span: 1 }
      ],
      columns: 4,
      groupId: 'test',
      id: 'test',
      label: 'Test',
      rows: 2
    }],
    version: 5
  })).toThrow('occupied twice')
})

test('numpad resolution remains host-neutral and prefix-aware', () => {
  const snapshot = NumpadTreeSnapshotSchema.parse({
    activationDigit: '0',
    diagnostics: [],
    generatedAt: '2026-08-19T00:00:00.000Z',
    nodes: [
      node('first', '1'),
      node('eleven', '11')
    ],
    revision: 1
  })

  expect(resolveNumpadLevel(snapshot, null, '1')).toMatchObject({
    exact: { commandId: 'test.first' },
    hasLongerMatches: true,
    status: 'ambiguous'
  })
})

function node (id: string, selector: string) {
  return {
    address: selector,
    available: true,
    commandId: `test.${id}`,
    id,
    kind: 'command' as const,
    label: id,
    parentId: null,
    risk: 'safe' as const,
    selector
  }
}
