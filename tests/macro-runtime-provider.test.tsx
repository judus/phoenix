import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import type { MacroRecording, PhoenixModules } from '@phoenix/contracts'
import type { PhoenixApi } from '../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixRouter } from '../apps/web/src/application/navigation/phoenix-router.js'
import {
  MacroRuntimeProvider,
  useMacroRuntime,
  type MacroRuntime
} from '../apps/web/src/features/macros/macro-runtime-provider.js'

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

test('macro recording uses the shared API, browser identity, and typed router', async () => {
  const recording: MacroRecording = {
    id: '65f4df62-c90c-4f4a-904e-4728d5554a78',
    clientId: 'macro-browser',
    entries: [],
    startedAt: '2026-08-16T12:00:00.000Z',
    status: 'recording'
  }
  const draft: MacroRecording = {
    ...recording,
    entries: [{
      actionId: 'elite.ShipSpotLightToggle',
      delayBeforeMs: 0,
      message: 'Accepted.',
      operation: 'tap',
      status: 'accepted'
    }],
    status: 'stopped'
  }
  const api = {
    getMacros: vi.fn().mockResolvedValue({ version: 1, macros: [] }),
    getModuleSettings: vi.fn().mockResolvedValue(modules()),
    startMacroRecording: vi.fn().mockResolvedValue(recording),
    stopMacroRecording: vi.fn().mockResolvedValue(draft)
  } as unknown as PhoenixApi
  const push = vi.fn()
  const router = { push } as unknown as PhoenixRouter
  let runtime: MacroRuntime | undefined

  function Probe() {
    runtime = useMacroRuntime()
    return null
  }

  const renderer = await act(async () => create(
    <MacroRuntimeProvider
      api={api}
      clientIdentity={{ forScope: () => 'macro-browser' }}
      router={router}
    >
      <Probe />
    </MacroRuntimeProvider>
  ))

  await act(async () => runtime?.startRecording())
  expect(api.startMacroRecording).toHaveBeenCalledWith('macro-browser')
  expect(push).toHaveBeenLastCalledWith({ kind: 'controls', category: 'ship' })
  expect(runtime?.recording).toEqual(recording)

  await act(async () => runtime?.stopRecording())
  expect(api.stopMacroRecording).toHaveBeenCalledWith(recording.id, 'macro-browser')
  expect(push).toHaveBeenLastCalledWith({ kind: 'macros' })
  expect(runtime?.draft).toEqual(draft)

  await act(async () => renderer.unmount())
})

function modules(): PhoenixModules {
  return {
    macros: { enabled: true, copilotExecution: false, dangerousExecution: false },
    numpadCommands: {
      enabled: false,
      inputAdapter: 'browser',
      presentation: 'tiles',
      alwaysConfirm: false,
      cancelAfterMs: 5000,
      shortcuts: []
    }
  }
}
