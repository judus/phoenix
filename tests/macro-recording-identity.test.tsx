import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import { MacroDefinitionSchema, type GameActionCatalogResponse, type GameActionResult, type MacroRecording } from '@phoenix/contracts'
import { MacroService } from '../apps/server/src/application/macro-service.js'
import { DefaultCommandRegistry } from '../apps/server/src/application/default-command-registry.js'
import type { GameActions } from '../apps/server/src/application/game-action-service.js'
import { InMemoryMacroRepository, JsonMacroRepository } from '../apps/server/src/infrastructure/macro-repositories.js'
import { macroDefinitionFromRecording } from '../apps/web/src/application/macros/macro-definition.js'
import type { MacroRuntime } from '../apps/web/src/application/macros/macro-runtime.js'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixRouter } from '../apps/web/src/application/navigation/phoenix-router.js'
import { MacroRuntimeProvider, useMacroRuntime } from '../apps/web/src/features/macros/macro-runtime-provider.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test.each([
  ['same provider', 'memory'], ['same provider', 'json'], ['different clients', 'memory'], ['different clients', 'json']
] as const)('overlapping recording stops from %s retain both macros in %s storage', async (clients, storage) => {
  const fixture = repositoryFixture(storage)
  const service = new MacroService(fixture.repository, acceptedActions)
  const stops = new Map<string, ReturnType<typeof deferred>>()
  const api = {
    getMacros: vi.fn(async () => service.getLibrary()),
    startMacroRecording: vi.fn(async (clientId: string) => service.startRecording(clientId)),
    recordMacroAction: vi.fn(async (id: string, clientId: string, actionId: string) => service.recordAction(id, { clientId, actionId, operation: 'tap' })),
    stopMacroRecording: vi.fn(async (id: string, clientId: string) => {
      const stopped = await service.stopRecording(id, clientId)
      await stops.get(id)!.promise
      return stopped
    }),
    saveMacro: vi.fn(async (macro: unknown) => service.save(macro))
  } as unknown as PhoenixApi
  const first = await mountProvider(api, 'first-client')
  const second = clients === 'same provider' ? first : await mountProvider(api, 'second-client')
  try {
    await act(async () => { await first.runtime().startRecording() })
    await act(async () => { await first.runtime().recordAction('elite.One', 'tap') })
    const firstId = first.runtime().recording!.id
    stops.set(firstId, deferred())
    let firstStop!: Promise<void>
    await act(async () => { firstStop = first.runtime().stopRecording() })

    await act(async () => { await second.runtime().startRecording() })
    await act(async () => { await second.runtime().recordAction('elite.Two', 'tap') })
    const secondId = second.runtime().recording!.id
    expect(secondId).not.toBe(firstId)
    stops.set(secondId, deferred())
    let secondStop!: Promise<void>
    await act(async () => { secondStop = second.runtime().stopRecording() })
    expect(api.saveMacro).not.toHaveBeenCalled()

    await act(async () => {
      stops.get(firstId)!.resolve()
      stops.get(secondId)!.resolve()
      await Promise.all([firstStop, secondStop])
    })
    const saved = service.getLibrary().macros
    expect(saved).toHaveLength(2)
    expect(new Set(saved.map(macro => macro.id)).size).toBe(2)
    // A stale display-name snapshot may choose the same name; names are not identities.
    expect(saved.map(macro => macro.name)).toEqual(['Macro 1', 'Macro 1'])
    expect(saved.map(macro => macro.steps[0])).toEqual(expect.arrayContaining([
      { type: 'game-action', actionId: 'elite.One', operation: 'tap' },
      { type: 'game-action', actionId: 'elite.Two', operation: 'tap' }
    ]))
    expect(first.runtime().error).toBeUndefined()
    expect(second.runtime().error).toBeUndefined()
    expect(second.runtime().recording).toBeUndefined()
    expect(second.push).toHaveBeenLastCalledWith({ kind: 'macros' })
  } finally {
    await first.unmount()
    if (second !== first) await second.unmount()
    fixture.cleanup()
  }
})

test('a recording-derived macro identity is stable across display-name changes and distinct across recordings', () => {
  const recording = stoppedRecording('65f4df62-c90c-4f4a-904e-4728d5554a78')
  const first = macroDefinitionFromRecording('Macro 1', recording)
  const renamed = macroDefinitionFromRecording('Renamed sequence', recording)
  const other = macroDefinitionFromRecording('Macro 1', stoppedRecording('78846ed5-aa5b-4f60-ab39-ff9ad42d44a2'))

  expect(first.id).toBe(`macro-${recording.id}`)
  expect(renamed.id).toBe(first.id)
  expect(renamed.name).toBe('Renamed sequence')
  expect(other.id).not.toBe(first.id)
  expect(MacroDefinitionSchema.parse(first)).toEqual(first)
})

test.each(['memory', 'json'] as const)('new recorded macros leave legacy edit-upserts and command targets intact in %s storage', storage => {
  const fixture = repositoryFixture(storage)
  try {
    const source = macroDefinitionFromRecording('Macro 1', stoppedRecording('65f4df62-c90c-4f4a-904e-4728d5554a78'))
    const legacy = { ...source, id: 'macro-1', name: 'Legacy sequence', numericAddress: '42' }
    fixture.repository.save(legacy)
    const registry = new DefaultCommandRegistry(acceptedActions, [], fixture.repository)
    const target = { type: 'macro' as const, macroId: legacy.id }
    expect(registry.find(target)).toMatchObject({ id: 'command.macro.macro-1', target, label: 'Legacy sequence' })

    fixture.repository.save(source)
    const renamed = macroDefinitionFromRecording('Renamed new sequence', stoppedRecording('65f4df62-c90c-4f4a-904e-4728d5554a78'))
    fixture.repository.save(renamed)
    fixture.repository.save({ ...legacy, name: 'Edited sequence' })
    expect(fixture.repository.getLibrary().macros).toHaveLength(2)
    expect(fixture.repository.get(source.id)).toEqual(renamed)
    expect(fixture.repository.get('macro-1')).toEqual({ ...legacy, name: 'Edited sequence' })
    expect(registry.find(target)).toMatchObject({ id: 'command.macro.macro-1', target, label: 'Edited sequence' })
    expect(registry.find({ type: 'macro', macroId: source.id })).toMatchObject({
      id: `command.macro.${source.id}`, target: { type: 'macro', macroId: source.id }
    })
  } finally { fixture.cleanup() }
})

function stoppedRecording (id: string): MacroRecording {
  return { id, clientId: 'first-client', startedAt: '2026-10-04T12:00:00Z', status: 'stopped',
    entries: [{ actionId: 'elite.One', delayBeforeMs: 0, message: 'Accepted.', operation: 'tap', status: 'accepted' }] }
}

function repositoryFixture (storage: 'memory' | 'json') {
  if (storage === 'memory') return { repository: new InMemoryMacroRepository(), cleanup: () => undefined }
  const directory = mkdtempSync(join(tmpdir(), 'phoenix-macro-identity-'))
  return { repository: new JsonMacroRepository(join(directory, 'macros.json')), cleanup: () => rmSync(directory, { force: true, recursive: true }) }
}

async function mountProvider (api: PhoenixApi, clientId: string) {
  let runtime!: MacroRuntime
  const push = vi.fn()
  function Probe () { runtime = useMacroRuntime(); return null }
  let renderer!: ReturnType<typeof create>
  await act(async () => {
    renderer = create(<MacroRuntimeProvider api={api} clientIdentity={{ forScope: () => clientId }} router={{ push } as unknown as PhoenixRouter}><Probe /></MacroRuntimeProvider>)
  })
  return { runtime: () => runtime, push, unmount: async () => { await act(async () => { renderer.unmount() }) } }
}

function deferred () {
  let resolve!: () => void
  const promise = new Promise<void>(accept => { resolve = accept })
  return { promise, resolve }
}

const acceptedActions: GameActions = {
  execute: async (candidate, origin) => ({
    ...(candidate as object), origin, correlationId: 'fixture', requestId: 'fixture', timestamp: '2026-10-04T12:00:00Z',
    message: 'Accepted.', status: 'accepted'
  } as GameActionResult),
  getCatalog: () => ({ actions: [] } as unknown as GameActionCatalogResponse)
}
