import { randomUUID } from 'node:crypto'
import { afterEach, expect, test, vi } from 'vitest'
import { ControlDeckCommandService } from 'control-deck/core'
import { RecordingKeyboardOutput, type KeyboardOutput } from 'control-deck/adapter-keyboard'
import { EliteDangerousCommandAdapter } from 'control-deck/integration-elite-dangerous'
import { createEmptyRuntimeState, type GameActionOrigin } from '@phoenix/contracts'
import { parseEliteStatus } from '@phoenix/elite'
import { InputOperationCoordinator } from '../apps/server/src/application/input-operation-coordinator.js'
import { EliteDestinationService, type EliteDestinationTiming } from '../apps/server/src/application/elite-destination-service.js'
import { ControlDeckEliteDestinationInput } from '../apps/server/src/infrastructure/control-deck-elite-destination-input.js'
import { ControlDeckEliteGameActionGateway } from '../apps/server/src/application/control-deck-elite-game-action-gateway.js'
import { GameActionService } from '../apps/server/src/application/game-action-service.js'
import { MacroService } from '../apps/server/src/application/macro-service.js'
import { InMemoryMacroRepository } from '../apps/server/src/infrastructure/macro-repositories.js'
import { DefaultCommandRegistry, PHOENIX_NAVIGATION_DESTINATIONS } from '../apps/server/src/application/default-command-registry.js'
import { DefaultCommandDispatcher } from '../apps/server/src/application/command-dispatcher.js'
import { PhoenixControlDeckCommandAdapter } from '../apps/server/src/application/phoenix-control-deck-command-adapter.js'
import { CommandCatalogueService } from '../apps/server/src/application/command-catalogue-service.js'
import { DefaultNumpadCommands, NumpadTreeProjector } from '../apps/server/src/application/numpad-command-service.js'
import { InMemoryControlDeckConfigurationRepository } from '../apps/server/src/infrastructure/in-memory-control-deck-configuration-repository.js'
import { CopilotCommands } from '../apps/server/src/application/copilot-commands.js'
import { DefaultCopilotCapabilityService } from '../apps/server/src/application/copilot-capability-service.js'
import { InMemorySystemSettingsRepository } from '../apps/server/src/infrastructure/json-system-configuration.js'
import { StaticEliteDangerousBindings } from './support/static-elite-dangerous-bindings.js'

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => {
  vi.useRealTimers()
  for (const cleanup of cleanups.splice(0)) await cleanup()
})

test('route ownership rejects manual, macro, recording, host, numpad and permitted Copilot input before effects', async () => {
  const f = fixture()
  const plotting = f.route.plot('Synthetic', f.abort.signal)
  await f.routeStarted.promise
  for (const origin of ['ui', 'numpad', 'copilot', 'automation'] satisfies GameActionOrigin[]) {
    expect(await f.actions.execute({ actionId: 'elite.UI_Select' }, origin)).toMatchObject({ status: 'rejected', message: expect.stringContaining('busy') })
  }
  expect(await f.macros.execute('tap', 'ui')).toMatchObject({ status: 'failed', completedSteps: 0, message: expect.stringContaining('busy') })
  const recording = f.macros.startRecording('client')
  expect((await f.macros.recordAction(recording.id, { clientId: 'client', actionId: 'elite.UI_Select', operation: 'tap' })).entries[0])
    .toMatchObject({ status: 'rejected' })
  await f.macros.cancelRecording(recording.id, 'client')
  expect(await f.host.execute({ target: { adapterId: 'phoenix.commands', commandId: 'command.elite.UI_Select', configuration: {} }, operation: 'tap' }, 'tablet'))
    .toMatchObject({ status: 'rejected', message: expect.stringContaining('busy') })
  const snapshot = f.numpad.getSnapshot()
  const node = snapshot.nodes.find(node => node.action?.type === 'command' && node.action.target.commandId === 'command.elite.ShipSpotLightToggle')!
  expect(node).toBeDefined()
  expect(await f.numpad.execute({ address: node.address, revision: snapshot.revision, operation: 'tap' })).toMatchObject({ status: 'rejected' })
  expect(await f.copilot.execute({ target: { type: 'game-action', actionId: 'elite.UI_Select' } }, 'copilot'))
    .toMatchObject({ status: 'rejected', message: expect.stringContaining('busy') })
  // Non-input navigation/read operations remain useful during a route operation.
  expect(await f.dispatcher.execute({ target: { type: 'navigation', destinationId: 'galaxy.atlas' } }, 'ui')).toMatchObject({ status: 'accepted' })
  expect(f.actions.getCatalog().backend.available).toBe(true)
  expect(f.inputs()).toEqual(['tap:g'])
  f.abort.abort()
  await plotting
  expect(f.inputs()).toEqual(['tap:g', 'tap:g'])
})

test('macro owns its waits and nested steps; route and new actions cannot enter until final release', async () => {
  const f = fixture()
  const pressed = Promise.withResolvers<void>()
  f.onInput = async (operation, key) => { if (operation === 'press' && key === 'Space') pressed.resolve() }
  const playback = f.macros.execute('hold', 'ui')
  await pressed.promise
  expect(await f.route.plot('Synthetic')).toMatchObject({ status: 'rejected', phase: 'preflight' })
  expect(await f.actions.execute({ actionId: 'elite.UI_Select' }, 'ui')).toMatchObject({ status: 'rejected' })
  expect(f.inputs()).toEqual(['press:Space'])
  f.macros.abortPlayback()
  expect(await playback).toMatchObject({ status: 'aborted' })
  expect(f.inputs()).toEqual(['press:Space', 'release:Space'])
  expect(await f.macros.execute('tap', 'ui')).toMatchObject({ status: 'completed', completedSteps: 1 })
  expect(f.inputs().at(-1)).toBe('tap:Enter')
})

test.each(['ui', 'numpad', 'copilot'] satisfies GameActionOrigin[])('existing %s hold rejects route start; renewal and release remain usable', async origin => {
  const f = fixture()
  const hold = { actionId: 'elite.PrimaryFire', operation: 'press', leaseId: 'existing' }
  expect(await f.actions.execute(hold, origin)).toMatchObject({ status: 'accepted' })
  expect(await f.route.plot('Synthetic')).toMatchObject({ status: 'rejected', message: expect.stringContaining('held game controls') })
  expect(await f.actions.execute(hold, origin)).toMatchObject({ status: 'accepted', message: 'Hold lease renewed.' })
  expect(f.inputs()).toEqual(['press:Space'])
  expect(await f.actions.execute({ ...hold, operation: 'release' }, origin)).toMatchObject({ status: 'accepted' })
  const plotting = f.route.plot('Synthetic', f.abort.signal)
  await f.routeStarted.promise
  f.abort.abort()
  await plotting
  expect(f.inputs()).toEqual(['press:Space', 'release:Space', 'tap:g', 'tap:g'])
})

test('recording holds block routes and cancelRecording releases the original lease', async () => {
  const f = fixture()
  const recording = f.macros.startRecording('client')
  await f.macros.recordAction(recording.id, { clientId: 'client', actionId: 'elite.PrimaryFire', operation: 'press' })
  expect(await f.route.plot('Synthetic')).toMatchObject({ status: 'rejected' })
  await f.macros.cancelRecording(recording.id, 'client')
  expect(await f.macros.execute('tap', 'ui')).toMatchObject({ status: 'completed' })
  expect(f.inputs()).toEqual(['press:Space', 'release:Space', 'tap:Enter'])
})

test('an in-flight press blocks route acquisition before its held lease is registered', async () => {
  const f = fixture()
  const started = Promise.withResolvers<void>()
  const finish = Promise.withResolvers<void>()
  f.onInput = async operation => { if (operation === 'press') { started.resolve(); await finish.promise } }
  const pressing = f.actions.execute({ actionId: 'elite.PrimaryFire', operation: 'press', leaseId: 'pending' }, 'ui')
  await started.promise
  expect(await f.route.plot('Synthetic')).toMatchObject({ status: 'rejected' })
  expect(f.inputs()).toEqual(['press:Space'])
  finish.resolve()
  await pressing
  await f.actions.execute({ actionId: 'elite.PrimaryFire', operation: 'release', leaseId: 'pending' }, 'ui')
})

test.each([
  { failCleanup: false, cancel: true }, { failCleanup: true, cancel: true },
  { failCleanup: false, cancel: false }, { failCleanup: true, cancel: false }
])('route retains ownership through final map cleanup (cancel=$cancel, failure=$failCleanup)', async ({ failCleanup, cancel }) => {
  const f = fixture()
  const closing = Promise.withResolvers<void>()
  const finish = Promise.withResolvers<void>()
  f.onInput = async (_operation, key) => {
    if (key === 'g' && f.inputs().length === 2) {
      closing.resolve()
      await finish.promise
      if (failCleanup) throw new Error('synthetic map close failure')
    }
  }
  if (!cancel) f.timing.pause = async () => { f.routeStarted.resolve(); throw new Error('synthetic route failure') }
  const plotting = f.route.plot('Synthetic', f.abort.signal)
  await f.routeStarted.promise
  if (cancel) f.abort.abort()
  await closing.promise
  expect(await f.actions.execute({ actionId: 'elite.UI_Select' }, 'ui')).toMatchObject({ status: 'rejected' })
  expect(await f.macros.execute('tap', 'ui')).toMatchObject({ completedSteps: 0, status: 'failed' })
  expect(f.inputs()).toEqual(['tap:g', 'tap:g'])
  finish.resolve()
  const result = await plotting
  expect(result.status).toBe('failed')
  if (!cancel) expect(result.message).toContain('synthetic route failure')
  if (failCleanup) expect(result.message).toContain('Galaxy Map cleanup failed: synthetic map close failure')
  expect(await f.actions.execute({ actionId: 'elite.UI_Select' }, 'ui')).toMatchObject({ status: 'accepted' })
})

test('hold expiry removes the reservation and shutdown cancels route cleanup before rejecting later input', async () => {
  const f = fixture(20)
  const released = Promise.withResolvers<void>()
  f.onInput = async operation => { if (operation === 'release') released.resolve() }
  await f.actions.execute({ actionId: 'elite.PrimaryFire', operation: 'press', leaseId: 'expires' }, 'ui')
  await released.promise
  // Wait for the runtime to acknowledge its completed release, not merely output invocation.
  await vi.waitFor(async () => { expect(await f.operations.exclusive('check released', async () => true)).toBe(true) })
  const plotting = f.route.plot('Synthetic', f.abort.signal)
  await f.routeStarted.promise
  await f.operations.stop()
  await plotting
  expect(f.inputs()).toEqual(['press:Space', 'release:Space', 'tap:g', 'tap:g'])
  expect(await f.actions.execute({ actionId: 'elite.UI_Select' }, 'ui')).toMatchObject({ status: 'rejected' })
})

test('shutdown permits existing-hold releases and cached idempotent outcomes without replay', async () => {
  const f = fixture()
  const request = { actionId: 'elite.UI_Select', idempotencyKey: 'once' }
  const first = await f.actions.execute(request, 'ui')
  await f.actions.execute({ actionId: 'elite.PrimaryFire', operation: 'press', leaseId: 'stop' }, 'ui')
  await f.operations.stop()
  expect(await f.actions.execute(request, 'ui')).toEqual(first)
  await f.actions.stop()
  expect(f.inputs()).toEqual(['tap:Enter', 'press:Space', 'release:Space'])
})

function fixture (maximumHoldMs = 15_000) {
  const operations = new InputOperationCoordinator()
  const recording = new RecordingKeyboardOutput()
  const state = createEmptyRuntimeState()
  state.gameStatus = parseEliteStatus({ event: 'Status', timestamp: '2026-10-24T00:00:00Z', Flags: 0, GuiFocus: 0 })
  const bindings = new StaticEliteDangerousBindings()
  const originalResolve = bindings.resolve.bind(bindings)
  bindings.resolve = name => originalResolve(name) ?? { key: name === 'GalaxyMapOpen' ? 'g' : 'Enter', modifiers: [], display: name }
  const originalCommands = bindings.listCommands.bind(bindings)
  bindings.listCommands = () => [...originalCommands(), 'UI_Select']
  const inputs = () => recording.getRecordedInputs().map(input => `${input.operation}:${input.configuration.key}`)
  const routeStarted = Promise.withResolvers<void>()
  const abort = new AbortController()
  const hook = { onInput: async (_operation: string, _key: string) => {} }
  const output: KeyboardOutput = { getStatus: () => recording.getStatus(), send: async (operation, binding, signal) => {
    await recording.send(operation, binding, signal)
    if (binding.key === 'g') state.gameStatus = parseEliteStatus({ event: 'Status', timestamp: `2026-10-24T00:00:0${inputs().length}Z`, Flags: 0, GuiFocus: state.gameStatus?.guiFocus?.id === 6 ? 0 : 6 })
    await hook.onInput(operation, binding.key)
  } }
  const eliteAdapter = new EliteDangerousCommandAdapter({ bindings, output })
  const eliteCommands = new ControlDeckCommandService([eliteAdapter], { createId: randomUUID })
  const actions = new GameActionService(new ControlDeckEliteGameActionGateway(eliteAdapter, eliteCommands), maximumHoldMs, operations)
  const repository = new InMemoryMacroRepository()
  for (const [id, steps] of [
    ['tap', [{ type: 'game-action', actionId: 'elite.UI_Select', operation: 'tap' }]],
    ['wait', [{ type: 'wait', durationMs: 10_000 }, { type: 'game-action', actionId: 'elite.UI_Select', operation: 'tap' }]],
    ['hold', [{ type: 'game-action', actionId: 'elite.PrimaryFire', operation: 'press' }, { type: 'wait', durationMs: 10_000 }]]
  ] as const) repository.save({ version: 1, id, name: id, description: '', enabled: true, risk: 'safe', assumptions: [], steps: [...steps] })
  const macros = new MacroService(repository, actions, undefined, 5_000, operations)
  const registry = new DefaultCommandRegistry(actions, undefined, repository)
  const dispatcher = new DefaultCommandDispatcher(registry, actions, PHOENIX_NAVIGATION_DESTINATIONS, undefined, macros)
  const host = new ControlDeckCommandService([new PhoenixControlDeckCommandAdapter(dispatcher, actions)], { createId: randomUUID })
  const numpad = new DefaultNumpadCommands(new NumpadTreeProjector(new CommandCatalogueService(registry), new InMemoryControlDeckConfigurationRepository()), dispatcher)
  const settings = new InMemorySystemSettingsRepository()
  const capabilities = new DefaultCopilotCapabilityService(() => [], registry, settings)
  const policy = { version: 2 as const, enabledCapabilityIds: ['command.elite.UI_Select'] }
  capabilities.saveInstallationPolicy(policy)
  capabilities.saveProfilePolicy(settings.loadOrCreate().copilot.activeProfileId, policy)
  const copilot = new CopilotCommands(dispatcher, capabilities)
  const timing: EliteDestinationTiming = {
    pause: async (_duration, signal) => {
      routeStarted.resolve()
      await new Promise<void>((_resolve, reject) => {
        if (signal?.aborted) reject(signal.reason)
        else signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    }, pollIntervalMs: 1, mapFocusTimeoutMs: 10, routeConfirmationTimeoutMs: 10
  }
  const route = new EliteDestinationService(new ControlDeckEliteDestinationInput(bindings, output), { getCurrent: () => state }, { getCurrent: () => ({ timestamp: null, route: [] }) }, timing, operations)
  const f = { operations, recording, actions, macros, route, abort, eliteCommands, dispatcher, host, numpad, copilot, routeStarted, inputs, timing,
    get onInput () { return hook.onInput }, set onInput (value: (operation: string, key: string) => Promise<void>) { hook.onInput = value } }
  cleanups.push(async () => {
    abort.abort()
    await operations.stop()
    await actions.stop()
    await eliteCommands.stop()
    await host.stop()
  })
  return f
}

test.each([
  { newerOwner: false, cancel: false }, { newerOwner: true, cancel: false },
  { newerOwner: false, cancel: true }, { newerOwner: true, cancel: true }
])('expired operation contexts cannot regain input ($newerOwner, cancelled=$cancel)', async ({ newerOwner, cancel }) => {
  const operations = new InputOperationCoordinator()
  const wake = Promise.withResolvers<void>()
  const releaseNew = Promise.withResolvers<void>()
  const newStarted = Promise.withResolvers<void>()
  let late!: Promise<void>
  let effects = 0
  const abort = new AbortController()
  await operations.exclusive('finished', async () => {
    // This callback inherits the old operation even though a later caller wakes it.
    late = wake.promise.then(async () => {
      await expect(operations.exclusive('late', async () => { effects++ })).rejects.toThrow('busy')
      await expect(operations.input('tap', async () => { operations.assertDispatch('tap'); effects++ })).rejects.toThrow('busy')
    })
    if (cancel) abort.abort()
  }, abort.signal)
  const active = newerOwner ? operations.exclusive('new owner', async () => { newStarted.resolve(); await releaseNew.promise }) : undefined
  if (newerOwner) await newStarted.promise
  wake.resolve()
  try { await late } finally { releaseNew.resolve(); await active }
  expect(effects).toBe(0)
  await operations.exclusive('fresh request', async () => {
    await operations.exclusive('live nested step', async () => { effects++ })
  })
  expect(effects).toBe(1)
  await operations.stop()
})

test('macro owns an input-free wait before its first action', async () => {
  const f = fixture()
  const playback = f.macros.execute('wait', 'ui')
  expect(f.macros.getPlayback()).toMatchObject({ status: 'running', completedSteps: 0 })
  expect(await f.route.plot('Synthetic')).toMatchObject({ status: 'rejected', message: expect.stringContaining('macro wait') })
  expect(f.inputs()).toEqual([])
  f.macros.abortPlayback()
  expect(await playback).toMatchObject({ status: 'aborted' })
})

test('pre-aborted macro and route preserve structured results without input', async () => {
  const f = fixture()
  const signal = AbortSignal.abort(new DOMException('caller left', 'AbortError'))
  expect(await f.macros.execute('tap', 'ui', signal)).toMatchObject({ status: 'aborted', completedSteps: 0 })
  expect(await f.route.plot('Synthetic', signal)).toMatchObject({ status: 'failed', phase: 'preflight' })
  expect(f.inputs()).toEqual([])
})

test('shutdown aborts a macro and allows its final held-key release', async () => {
  const f = fixture()
  const pressed = Promise.withResolvers<void>()
  f.onInput = async operation => { if (operation === 'press') pressed.resolve() }
  const playback = f.macros.execute('hold', 'ui')
  await pressed.promise
  await f.operations.stop()
  expect(await playback).toMatchObject({ status: 'aborted' })
  expect(f.inputs()).toEqual(['press:Space', 'release:Space'])
})

test('a cancelled live owner can release, but cannot dispatch new input or acquire nested authority', async () => {
  const f = fixture()
  const abort = new AbortController()
  await f.operations.exclusive('sequence', async () => {
    await f.actions.execute({ actionId: 'elite.PrimaryFire', operation: 'press', leaseId: 'cleanup' }, 'ui')
    abort.abort()
    expect(await f.actions.execute({ actionId: 'elite.UI_Select' }, 'ui')).toMatchObject({ status: 'rejected' })
    await expect(f.operations.exclusive('after cancellation', async () => { throw new Error('must not run') })).rejects.toThrow('busy')
    expect(await f.actions.execute({ actionId: 'elite.PrimaryFire', operation: 'release', leaseId: 'cleanup' }, 'ui')).toMatchObject({ status: 'accepted' })
  }, abort.signal)
  expect(f.inputs()).toEqual(['press:Space', 'release:Space'])
})

test('host-owned holds block route startup and their original release removes the reservation', async () => {
  const f = fixture()
  const target = { adapterId: 'phoenix.commands', commandId: 'command.elite.PrimaryFire', configuration: {} }
  expect(await f.host.execute({ target, operation: 'press', leaseId: 'host-hold' }, 'tablet')).toMatchObject({ status: 'accepted' })
  expect(await f.route.plot('Synthetic')).toMatchObject({ status: 'rejected' })
  expect(await f.host.execute({ target, operation: 'release', leaseId: 'host-hold' }, 'tablet')).toMatchObject({ status: 'accepted' })
  expect(await f.macros.execute('tap', 'ui')).toMatchObject({ status: 'completed' })
  expect(f.inputs()).toEqual(['press:Space', 'release:Space', 'tap:Enter'])
})

test('a finished owner can still release its hold without regaining input authority', async () => {
  const f = fixture()
  const wake = Promise.withResolvers<void>()
  let release!: Promise<unknown>
  await f.operations.exclusive('sequence', async () => {
    await f.actions.execute({ actionId: 'elite.PrimaryFire', operation: 'press', leaseId: 'late-release' }, 'ui')
    release = wake.promise.then(() => f.actions.execute({ actionId: 'elite.PrimaryFire', operation: 'release', leaseId: 'late-release' }, 'ui'))
  })
  expect(await f.route.plot('Synthetic')).toMatchObject({ status: 'rejected' })
  wake.resolve()
  expect(await release).toMatchObject({ status: 'accepted' })
  expect(await f.macros.execute('tap', 'ui')).toMatchObject({ status: 'completed' })
})

test('failed hold release retains exclusion until an explicit authorized release succeeds', async () => {
  const f = fixture()
  await f.actions.execute({ actionId: 'elite.PrimaryFire', operation: 'press', leaseId: 'held' }, 'ui')
  f.onInput = async operation => { if (operation === 'release') throw new Error('synthetic release failure') }
  expect(await f.actions.execute({ actionId: 'elite.PrimaryFire', operation: 'release', leaseId: 'held' }, 'ui')).toMatchObject({ status: 'failed' })
  expect(await f.route.plot('Synthetic')).toMatchObject({ status: 'rejected' })
  f.onInput = async () => {}
  expect(await f.actions.execute({ actionId: 'elite.PrimaryFire', operation: 'release', leaseId: 'held' }, 'ui')).toMatchObject({ status: 'accepted' })
  expect(await f.macros.execute('tap', 'ui')).toMatchObject({ status: 'completed' })
})

test('a busy press queued behind a failed lease transition cannot dispatch after the exclusive owner finishes', async () => {
  const f = fixture()
  const started = Promise.withResolvers<void>()
  const finishOutput = Promise.withResolvers<void>()
  const finishOwner = Promise.withResolvers<void>()
  f.onInput = async operation => {
    if (operation === 'press') { started.resolve(); await finishOutput.promise; throw new Error('synthetic rejected press') }
  }
  const request = { actionId: 'elite.PrimaryFire', operation: 'press', leaseId: 'queued' }
  let first!: ReturnType<typeof f.actions.execute>
  const owner = f.operations.exclusive('sequence', async () => {
    first = f.actions.execute(request, 'ui')
    // Deliberately leave the first dispatch in flight when this owner finishes.
    await finishOwner.promise
  })
  await started.promise
  const blocked = f.actions.execute(request, 'ui')
  finishOwner.resolve()
  await owner
  finishOutput.resolve()
  expect(await first).toMatchObject({ status: 'failed' })
  expect(await blocked).toMatchObject({ status: 'rejected', message: expect.stringContaining('busy') })
  expect(f.inputs()).toEqual(['press:Space'])
  expect(await f.actions.execute({ actionId: 'elite.UI_Select' }, 'ui')).toMatchObject({ status: 'accepted' })
})
