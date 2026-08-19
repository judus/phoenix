import { expect, test } from 'vitest'
import type { GameActionCatalogResponse, GameActionOrigin, GameActionResult } from '@phoenix/contracts'
import { CommandCatalogueService } from '../apps/server/src/application/command-catalogue-service.js'
import { DefaultCommandRegistry } from '../apps/server/src/application/default-command-registry.js'
import type { GameActions } from '../apps/server/src/application/game-action-service.js'
import type { CommandCatalogueChange } from '../apps/server/src/domain/commands.js'
import { InProcessPublisher } from '../apps/server/src/infrastructure/in-process-publisher.js'
import { InMemoryMacroRepository } from '../apps/server/src/infrastructure/macro-repositories.js'
import { NotifyingMacroRepository } from '../apps/server/src/infrastructure/notifying-command-source-repositories.js'

test('successful command-source mutations publish one immutable catalogue revision', () => {
  const changes = new InProcessPublisher<CommandCatalogueChange>()
  const macros = new NotifyingMacroRepository(new InMemoryMacroRepository(), changes)
  const registry = new DefaultCommandRegistry(new StubGameActions(), [], macros)
  const catalogue = new CommandCatalogueService(registry, changes, () => new Date('2026-08-14T00:00:00.000Z'))
  const revisions: number[] = []
  catalogue.subscribe(snapshot => revisions.push(snapshot.revision))

  const initial = catalogue.getSnapshot()
  macros.save({
    assumptions: [],
    description: '',
    enabled: true,
    id: 'panic-button',
    name: 'Panic Button',
    risk: 'safe',
    steps: [{ type: 'wait', durationMs: 1 }],
    version: 2
  })

  expect(initial.revision).toBe(1)
  expect(revisions).toEqual([2])
  expect(catalogue.getSnapshot()).toMatchObject({
    revision: 2,
    commands: [expect.objectContaining({ id: 'command.macro.panic-button' })]
  })
  expect(initial.commands).toEqual([])
})

test('failed persistence does not announce a catalogue revision', () => {
  const changes = new InProcessPublisher<CommandCatalogueChange>()
  const macros = new NotifyingMacroRepository({
    delete: () => { throw new Error('disk full') },
    get: () => undefined,
    getLibrary: () => ({ version: 2, macros: [] }),
    save: () => { throw new Error('disk full') }
  }, changes)
  const observed: CommandCatalogueChange[] = []
  changes.subscribe(change => observed.push(change))

  expect(() => macros.delete('panic-button')).toThrow('disk full')
  expect(observed).toEqual([])
})

class StubGameActions implements GameActions {
  public async execute (_candidate: unknown, _origin: GameActionOrigin): Promise<GameActionResult> {
    throw new Error('Not used.')
  }

  public getCatalog (): GameActionCatalogResponse {
    return {
      actions: [],
      backend: { available: true, detail: 'test', id: 'test', simulated: true },
      bindingSource: {
        available: true,
        bindingCount: 0,
        directory: null,
        error: null,
        filePath: null,
        keyboardBindingCount: 0,
        loadedAt: null,
        presetNames: []
      }
    }
  }
}
