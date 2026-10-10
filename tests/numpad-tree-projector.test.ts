import { expect, test, vi } from 'vitest'
import { CommandDescriptorSchema, commandTargetKey, phoenixTargetToControlDeckTarget, type CommandDescriptor } from '@phoenix/contracts'
import { ControlDeckConfigurationConflictError, createControlDeckGroup, removeControlDeck, type ControlDeckGridCommandElement } from 'control-deck/core'
import { CommandCatalogueService } from '../apps/server/src/application/command-catalogue-service.js'
import { PHOENIX_NAVIGATION_DESTINATIONS } from '../apps/server/src/application/default-command-registry.js'
import { NumpadTreeProjector } from '../apps/server/src/application/numpad-command-service.js'
import type { CommandCatalogueChange } from '../apps/server/src/domain/commands.js'
import { InMemoryControlDeckConfigurationRepository } from '../apps/server/src/infrastructure/in-memory-control-deck-configuration-repository.js'
import { InProcessPublisher } from '../apps/server/src/infrastructure/in-process-publisher.js'
import { NotifyingControlDeckConfigurationRepository } from '../apps/server/src/infrastructure/notifying-command-source-repositories.js'
import { activateControlDeckNumpadSession, displayedControlDeckNumpadAddress, enterControlDeckNumpadDigitOrCancel } from 'control-deck/core'

test('Controls selects saved decks in order and never synthesizes macro menus', () => {
  const { projector } = fixture()
  const snapshot = projector.getSnapshot()
  expect(snapshot.nodes.filter(node => node.parentId === 'phoenix:desktop.controls').map(node => [node.selector, node.label]))
    .toEqual([
      ['1', 'Quick access'], ['2', 'Ship'], ['3', 'Combat'], ['4', 'Navigation'], ['5', 'Vessel'],
      ['6', 'SRV'], ['7', 'On Foot'], ['8', 'Radio'], ['9', 'Emotes']
    ])
  expect(snapshot.nodes.some(node => node.action?.type === 'command' && node.action.target.commandId.startsWith('command.macro.'))).toBe(false)
  expect(snapshot.nodes.filter(node => node.parentId === null).map(node => [node.address, node.label]))
    .toEqual([['1', 'Controls'], ['2', 'Info'], ['3', 'Copilot'], ['4', 'Macros'], ['5', 'Log'], ['6', 'Settings']])
  expect(snapshot.nodes.find(node => node.address === '4')).toMatchObject({
    action: { type: 'command', target: { commandId: 'command.navigation.macros.library' } }
  })

  for (const [digit, id] of [['1', 'quick'], ['2', 'ship'], ['3', 'combat']]) {
    let state = activateControlDeckNumpadSession()
    state = enterControlDeckNumpadDigitOrCancel(snapshot, state, '1').state
    state = enterControlDeckNumpadDigitOrCancel(snapshot, state, digit!).state
    expect(state).toMatchObject({ pathIds: ['phoenix:desktop.controls', `phoenix:controls.${id}`], status: 'browsing', pendingDigits: '' })
    expect(displayedControlDeckNumpadAddress(snapshot, state)).toBe(`01${digit}`)
  }
})

test('only successful saves rebuild the tree; drafts and stale saves leave the revision alone', () => {
  const { projector, repository, persisted } = fixture()
  const reads = vi.spyOn(persisted, 'getConfiguration')
  const first = projector.getSnapshot()
  expect(reads).toHaveBeenCalledTimes(1)
  expect(projector.getSnapshot()).toEqual(first)
  expect(reads).toHaveBeenCalledTimes(1)

  const draft = repository.getConfiguration()
  const stale = structuredClone(draft)
  draft.decks.reverse()
  draft.groups!.find(group => group.id === 'emote')!.name = 'My emotes'
  expect(projector.getSnapshot()).toEqual(first)
  repository.saveConfiguration(draft)
  reads.mockClear()
  const saved = projector.getSnapshot()
  expect(saved.revision).toBe(first.revision + 1)
  expect(saved.nodes).toContainEqual(expect.objectContaining({ id: 'phoenix:controls.emote', selector: '1', label: 'My emotes' }))
  expect(reads).toHaveBeenCalledTimes(1)
  expect(() => repository.saveConfiguration(stale)).toThrow(ControlDeckConfigurationConflictError)
  expect(projector.getSnapshot()).toEqual(saved)
  expect(reads).toHaveBeenCalledTimes(1)

  saved.nodes[0]!.label = 'Not persisted'
  saved.diagnostics.push('Not persisted')
  expect(projector.getSnapshot()).not.toEqual(saved)
  expect(projector.getSnapshot().nodes[0]!.label).toBe('Controls')
})

test('custom deck creation and deletion rebuild Numpy without fixed-context restrictions', () => {
  const { projector, repository } = fixture()
  const created = createControlDeckGroup(repository.getConfiguration())
  repository.saveConfiguration(created.configuration)
  const withCustom = projector.getSnapshot()
  expect(withCustom.nodes).toContainEqual(expect.objectContaining({ id: `phoenix:controls.${created.deck.id}`, selector: '10' }))
  repository.saveConfiguration(removeControlDeck(repository.getConfiguration(), created.deck.id).configuration)
  const removed = projector.getSnapshot()
  expect(removed.revision).toBe(withCustom.revision + 1)
  expect(removed.nodes.some(node => node.id === `phoenix:controls.${created.deck.id}`)).toBe(false)
})

test('assigned macros use their saved slot, label, geometry and confirmation, and track catalogue changes', () => {
  const { projector, repository, catalogue, commands } = fixture()
  const configuration = repository.getConfiguration()
  const quick = configuration.decks.find(deck => deck.id === 'quick')!
  const button: ControlDeckGridCommandElement = {
    id: 'assigned-macro', kind: 'command',
    target: phoenixTargetToControlDeckTarget({ type: 'macro', macroId: 'test' }),
    placement: { kind: 'grid', row: 2, column: 2, columnSpan: 2, rowSpan: 1 },
    appearance: { label: 'My button', icon: null, foregroundColor: null, backgroundColor: null },
    interaction: { activation: 'command-default', confirmation: { kind: 'arm-then-tap', armedForMs: 5000 } }
  }
  quick.elements = [button]
  repository.saveConfiguration(configuration)
  const first = projector.getSnapshot()
  const assigned = first.nodes.filter(node => node.action?.type === 'command' && node.action.target.commandId === 'command.macro.test')
  expect(assigned).toHaveLength(1)
  expect(assigned[0]).toMatchObject({ address: '116', label: 'My button', position: 6, columnSpan: 2, rowSpan: 1, confirm: true, interactionHint: 'arm', available: true })

  const draft = repository.getConfiguration()
  const moved = draft.decks.find(deck => deck.id === 'quick')!.elements[0]!
  moved.placement.row = 3
  repository.saveConfiguration(draft)
  expect(projector.getSnapshot().nodes.find(node => node.id === assigned[0]!.id)).toMatchObject({ address: '1110', position: 10 })
  expect(assigned[0]!.address).toBe('116')

  const macro = commands.find(command => command.kind === 'macro')!
  macro.available = false
  macro.unavailableReason = 'Macro is disabled.'
  catalogue.invalidate({ source: 'macros' })
  const disabled = projector.getSnapshot()
  expect(disabled.nodes.find(node => node.id === assigned[0]!.id)).toMatchObject({ available: false, unavailableReason: 'Macro is disabled.' })

  commands.splice(commands.indexOf(macro), 1)
  catalogue.invalidate({ source: 'macros' })
  const deleted = projector.getSnapshot()
  expect(deleted.nodes.some(node => node.id === assigned[0]!.id)).toBe(false)
  expect(deleted.diagnostics).toContain('Control element quick:assigned-macro targets an unknown command.')
})

function fixture () {
  const commands: CommandDescriptor[] = PHOENIX_NAVIGATION_DESTINATIONS.map(destination => CommandDescriptorSchema.parse({
    id: `command.navigation.${destination.id}`, kind: 'navigation', label: destination.label,
    activation: 'open', category: destination.category, available: true, risk: 'safe',
    target: { type: 'navigation', destinationId: destination.id }
  }))
  commands.push(CommandDescriptorSchema.parse({
    id: 'command.macro.test', kind: 'macro', label: 'Test macro', category: 'Macros', available: true,
    risk: 'safe', target: { type: 'macro', macroId: 'test' }
  }))
  const changes = new InProcessPublisher<CommandCatalogueChange>()
  const persisted = new InMemoryControlDeckConfigurationRepository()
  const repository = new NotifyingControlDeckConfigurationRepository(persisted, changes)
  const catalogue = new CommandCatalogueService({
    getCatalog: () => ({ commands }),
    find: target => commands.find(command => commandTargetKey(command.target) === commandTargetKey(target))
  }, changes)
  return { commands, repository, persisted, catalogue, projector: new NumpadTreeProjector(catalogue, repository) }
}
