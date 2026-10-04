import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { MacroRecording } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { ClientIdentity } from '../apps/web/src/application/identity/client-identity.js'
import type { MacroRuntime } from '../apps/web/src/application/macros/macro-runtime.js'
import type { PhoenixRouter } from '../apps/web/src/application/navigation/phoenix-router.js'
import { MacroRuntimeProvider, useMacroRuntime } from '../apps/web/src/features/macros/macro-runtime-provider.js'

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test.each([
  ['stop', 'resolve'], ['stop', 'reject'], ['cancel', 'resolve'], ['cancel', 'reject']
] as const)('a delayed action %s/%s cannot reopen or taint a completed recording', async (operation, settlement) => {
  const pending = deferred<MacroRecording>()
  const api = recordingApi()
  api.recordMacroAction.mockReturnValue(pending.promise)
  const harness = await mountProvider(api)
  try {
    await act(async () => { await harness.runtime().startRecording() })
    let action!: Promise<unknown>
    await act(async () => { action = harness.runtime().recordAction('elite.One', 'tap').catch(cause => cause) })
    await act(async () => { await (operation === 'stop' ? harness.runtime().stopRecording() : harness.runtime().cancelRecording()) })
    expect(harness.runtime().recording).toBeUndefined()
    const current = harness.runtime()
    const cause = new Error('Late failure')
    await act(async () => {
      if (settlement === 'resolve') pending.resolve(recording(OLD_ID, 1))
      else pending.reject(cause)
      expect(await action).toBe(settlement === 'reject' ? cause : undefined)
    })
    expect(harness.runtime()).toBe(current)
    expect(harness.runtime().error).toBeUndefined()
    expect(harness.push).toHaveBeenLastCalledWith({ kind: 'macros' })
  } finally { await harness.unmount() }
})

test.each(['resolve', 'reject'] as const)('an old action %s cannot overwrite a replacement recording', async settlement => {
  const pending = deferred<MacroRecording>()
  const api = recordingApi()
  api.recordMacroAction.mockReturnValue(pending.promise)
  api.startMacroRecording.mockResolvedValueOnce(recording(OLD_ID)).mockResolvedValueOnce(recording(NEW_ID))
  const harness = await mountProvider(api)
  try {
    await act(async () => { await harness.runtime().startRecording() })
    let action!: Promise<unknown>
    await act(async () => { action = harness.runtime().recordAction('elite.One', 'press').catch(cause => cause) })
    await act(async () => { await harness.runtime().startRecording() })
    const current = harness.runtime()
    await act(async () => {
      if (settlement === 'resolve') pending.resolve(recording(OLD_ID, 1))
      else pending.reject(new Error('Old recording failure'))
      await action
    })
    expect(harness.runtime()).toBe(current)
    expect(harness.runtime().recording).toEqual(recording(NEW_ID))
    expect(harness.runtime().error).toBeUndefined()
  } finally { await harness.unmount() }
})

test('an old provider lifetime cannot publish an action into a new API session even with the same recording ID', async () => {
  const pending = deferred<MacroRecording>()
  const old = recordingApi()
  old.recordMacroAction.mockReturnValue(pending.promise)
  const harness = await mountProvider(old)
  try {
    await act(async () => { await harness.runtime().startRecording() })
    let action!: Promise<void>
    await act(async () => { action = harness.runtime().recordAction('elite.One', 'tap') })
    await harness.update(recordingApi())
    await act(async () => { await harness.runtime().startRecording() })
    const current = harness.runtime()
    await act(async () => { pending.resolve(recording(OLD_ID, 1)); await action })
    expect(harness.runtime()).toBe(current)
    expect(harness.runtime().recording?.entries).toEqual([])
  } finally { await harness.unmount() }
})

test.each([
  ['stop', 'resolve'], ['stop', 'reject'], ['cancel', 'resolve'], ['cancel', 'reject']
] as const)('an obsolete closing %s/%s cannot clear or taint a replacement recording', async (operation, settlement) => {
  const pending = deferred<MacroRecording | undefined>()
  const api = recordingApi()
  if (operation === 'stop') api.stopMacroRecording.mockReturnValue(pending.promise)
  else api.cancelMacroRecording.mockReturnValue(pending.promise)
  api.startMacroRecording.mockResolvedValueOnce(recording(OLD_ID)).mockResolvedValueOnce(recording(NEW_ID))
  const harness = await mountProvider(api)
  try {
    await act(async () => { await harness.runtime().startRecording() })
    let closing!: Promise<void>
    await act(async () => { closing = operation === 'stop' ? harness.runtime().stopRecording() : harness.runtime().cancelRecording() })
    await act(async () => { await harness.runtime().startRecording() })
    const navigationCalls = harness.push.mock.calls.length
    await act(async () => {
      if (settlement === 'resolve') pending.resolve(operation === 'stop' ? { ...recording(OLD_ID, 1), status: 'stopped' } : undefined)
      else pending.reject(new Error('Old closing failure'))
      await closing
    })
    expect(harness.runtime().recording).toEqual(recording(NEW_ID))
    expect(harness.runtime().error).toBeUndefined()
    expect(harness.push).toHaveBeenCalledTimes(navigationCalls)
    if (operation === 'stop' && settlement === 'resolve') {
      expect(api.saveMacro).toHaveBeenCalledWith(expect.objectContaining({ steps: [{ type: 'game-action', actionId: 'elite.One', operation: 'tap' }] }))
      expect(harness.runtime().lastSavedMacroId).toBe(`macro-${OLD_ID}`)
    } else expect(api.saveMacro).not.toHaveBeenCalled()
    await act(async () => { await harness.runtime().recordAction('elite.One', 'tap') })
    expect(api.recordMacroAction).toHaveBeenLastCalledWith(NEW_ID, 'macro-browser', 'elite.One', 'tap')
  } finally { await harness.unmount() }
})

test('current recording action responses and failures still reach the UI and caller', async () => {
  const api = recordingApi()
  const cause = new Error('Current action failure')
  api.recordMacroAction.mockResolvedValueOnce(recording(OLD_ID, 1)).mockRejectedValueOnce(cause)
  const harness = await mountProvider(api)
  try {
    await act(async () => { await harness.runtime().startRecording() })
    await act(async () => { await harness.runtime().recordAction('elite.One', 'tap') })
    expect(harness.runtime().recording).toEqual(recording(OLD_ID, 1))
    await act(async () => { await expect(harness.runtime().recordAction('elite.One', 'release')).rejects.toBe(cause) })
    expect(harness.runtime().error).toBe('Current action failure')
    expect(api.recordMacroAction).toHaveBeenLastCalledWith(OLD_ID, 'macro-browser', 'elite.One', 'release')
  } finally { await harness.unmount() }
})

test('an obsolete start response cannot replace a new API recording or navigate after unmount', async () => {
  const pending = deferred<MacroRecording>()
  const previous = recordingApi()
  previous.startMacroRecording.mockReturnValue(pending.promise)
  const harness = await mountProvider(previous)
  try {
    let start!: Promise<void>
    await act(async () => { start = harness.runtime().startRecording() })
    const current = recordingApi()
    current.startMacroRecording.mockResolvedValue(recording(NEW_ID))
    await harness.update(current)
    await act(async () => { await harness.runtime().startRecording() })
    const runtime = harness.runtime()
    const calls = harness.push.mock.calls.length
    await harness.unmount()
    await act(async () => { pending.resolve(recording(OLD_ID)); await start })
    expect(harness.runtime()).toBe(runtime)
    expect(harness.runtime().recording).toEqual(recording(NEW_ID))
    expect(harness.push).toHaveBeenCalledTimes(calls)
  } finally { await harness.unmount() }
})

test('retained action callbacks cannot send an obsolete API request after lifetime replacement', async () => {
  const previous = recordingApi()
  const harness = await mountProvider(previous)
  try {
    await act(async () => { await harness.runtime().startRecording() })
    const retained = harness.runtime().recordAction
    await harness.update(recordingApi())
    await act(async () => { await harness.runtime().startRecording() })
    await act(async () => { await retained('elite.One', 'tap') })
    expect(previous.recordMacroAction).not.toHaveBeenCalled()
  } finally { await harness.unmount() }
})

test('recording responses after unmount settle without navigating or saving', async () => {
  const pending = deferred<MacroRecording>()
  const api = recordingApi()
  api.recordMacroAction.mockReturnValue(pending.promise)
  const harness = await mountProvider(api)
  await act(async () => { await harness.runtime().startRecording() })
  let action!: Promise<void>
  await act(async () => { action = harness.runtime().recordAction('elite.One', 'tap') })
  await harness.unmount()
  const calls = harness.push.mock.calls.length
  await act(async () => { pending.resolve(recording(OLD_ID, 1)); await action })
  expect(harness.push).toHaveBeenCalledTimes(calls)
  expect(api.saveMacro).not.toHaveBeenCalled()
})

const OLD_ID = '65f4df62-c90c-4f4a-904e-4728d5554a78'
const NEW_ID = '78846ed5-aa5b-4f60-ab39-ff9ad42d44a2'

function recording(id: string, actions = 0): MacroRecording {
  return {
    id, clientId: 'macro-browser', startedAt: '2026-10-04T12:00:00Z', status: 'recording',
    entries: Array.from({ length: actions }, () => ({ actionId: 'elite.One', delayBeforeMs: 0, operation: 'tap', status: 'accepted', message: 'Accepted' }))
  }
}

function recordingApi() {
  return {
    getMacros: vi.fn().mockResolvedValue({ version: 1, macros: [] }),
    startMacroRecording: vi.fn().mockResolvedValue(recording(OLD_ID)),
    stopMacroRecording: vi.fn().mockResolvedValue({ ...recording(OLD_ID, 1), status: 'stopped' }),
    cancelMacroRecording: vi.fn().mockResolvedValue(undefined),
    recordMacroAction: vi.fn(async (id: string) => recording(id, 1)),
    saveMacro: vi.fn(async macro => macro)
  }
}

async function mountProvider(api: ReturnType<typeof recordingApi>) {
  let runtime!: MacroRuntime
  const push = vi.fn()
  const router = { push } as unknown as PhoenixRouter
  const clientIdentity: ClientIdentity = { forScope: () => 'macro-browser' }
  function Probe() { runtime = useMacroRuntime(); return null }
  const tree = (api: ReturnType<typeof recordingApi>) => <MacroRuntimeProvider api={api as unknown as PhoenixApi} router={router} clientIdentity={clientIdentity}><Probe /></MacroRuntimeProvider>
  let renderer!: ReturnType<typeof create>
  await act(async () => { renderer = create(tree(api)) })
  return {
    runtime: () => runtime, push,
    update: async (api: ReturnType<typeof recordingApi>) => { await act(async () => { renderer.update(tree(api)) }) },
    unmount: async () => { await act(async () => { renderer.unmount() }) }
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (cause: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
