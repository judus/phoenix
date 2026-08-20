import { aggregateControlDeckNumpadTrees, controlDeckNumpadContribution, ControlDeckConfigurationSchema } from '@jdu/control-deck-core'
import { expect, test } from 'vitest'
import type { NumpadTreeSnapshot } from '@phoenix/contracts'
import { phoenixNumpadContributions } from '../apps/web/src/features/controls/controls-page.js'

test('PHOENIX contributes navigation and custom-command branches beside Control Deck', () => {
  const snapshot = numpadSnapshot()
  const contributions = phoenixNumpadContributions(snapshot)
  const tree = aggregateControlDeckNumpadTrees([
    controlDeckNumpadContribution(ControlDeckConfigurationSchema.parse({
      version: 1,
      groups: [{ id: 'ship', name: 'Ship', description: '' }],
      decks: [{
        id: 'ship_01', groupId: 'ship', name: '01', description: '', context: 'phoenix:ship',
        layout: { kind: 'grid', columns: 1, rows: 1 }, elements: []
      }],
      displays: []
    })),
    ...contributions
  ])

  expect(tree.nodes.filter(node => node.parentId === null).map(node => [node.selector, node.label]))
    .toEqual([['1', 'Decks'], ['2', 'PHOENIX'], ['3', 'Custom']])
  expect(tree.nodes.find(node => node.id === 'phoenix-navigation:desktop.info')?.parentId)
    .toBe('phoenix-navigation:root')
  expect(tree.nodes.some(node => node.id.includes('desktop.controls'))).toBe(false)
  expect(tree.nodes.find(node => node.id === 'phoenix-custom:shortcut.lights')?.action)
    .toEqual({ type: 'navigation', destinationId: 'phoenix-numpad:7:01' })
})

test('PHOENIX navigation actions retain the authoritative Numpad revision and address', () => {
  const [navigation] = phoenixNumpadContributions(numpadSnapshot())
  const commander = navigation!.nodes.find(node => node.id === 'info.commander')

  expect(commander?.action).toEqual({ type: 'navigation', destinationId: 'phoenix-numpad:7:21' })
  expect(commander?.parentId).toBe('desktop.info')
})

function numpadSnapshot (): NumpadTreeSnapshot {
  const menu = (id: string, parentId: string | null, selector: string, address: string, label: string) => ({
    id, parentId, selector, address, label, kind: 'menu' as const, available: true,
    risk: 'safe' as const, target: null
  })
  return {
    revision: 7,
    generatedAt: '2026-08-20T12:00:00.000Z',
    activationDigit: '0',
    diagnostics: [],
    nodes: [
      menu('desktop.shortcuts', null, '0', '0', 'Shortcuts'),
      { ...menu('shortcut.lights', 'desktop.shortcuts', '1', '01', 'Lights'), kind: 'game-action', target: { type: 'game-action', actionId: 'elite.lights' } },
      menu('desktop.controls', null, '1', '1', 'Controls'),
      menu('controls.ship', 'desktop.controls', '1', '11', 'Ship'),
      menu('desktop.info', null, '2', '2', 'Information'),
      { ...menu('info.commander', 'desktop.info', '1', '21', 'Commander'), kind: 'navigation', target: { type: 'navigation', destinationId: '#/information/commander' } },
      menu('desktop.copilot', null, '3', '3', 'Copilot')
    ]
  }
}
