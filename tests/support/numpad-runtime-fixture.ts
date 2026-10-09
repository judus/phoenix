import { phoenixApiStub } from './phoenix-api-stub.js'
import { vi } from 'vitest'
import type { NumpadExecutionResult, NumpadTreeSnapshot, PhoenixModules } from '@phoenix/contracts'
import type { PhoenixApi } from '../../apps/web/src/application/api/phoenix-api.js'
import type { PhoenixEventHub } from '../../apps/web/src/application/events/phoenix-event-hub.js'
import type { PhoenixRouter } from '../../apps/web/src/application/navigation/phoenix-router.js'
import type { PhoenixRoute } from '../../apps/web/src/application/navigation/phoenix-route.js'
import { NumpadRuntime } from '../../apps/web/src/features/numpad/numpad-runtime.js'

export const numpadTree: NumpadTreeSnapshot = {
  activationDigit: '0', revision: 1, generatedAt: '2026-10-05T00:00:00.000Z', diagnostics: [],
  nodes: [
    { id: 'controls', parentId: null, selector: '1', address: '1', label: 'Controls', available: true, action: null, interactionHint: 'open' },
    { id: 'deck', parentId: 'controls', selector: '1', address: '11', label: 'Quick access', available: true, action: null, interactionHint: 'open' },
    { id: 'system', parentId: 'deck', selector: '2', address: '112', label: 'System', available: true, interactionHint: 'open', action: { type: 'command', activation: 'tap', target: { adapterId: 'phoenix', commandId: 'system', configuration: {} } } }
  ]
}

export function numpadRuntimeFixture() {
  const settings: PhoenixModules = {
    currentShip: { moduleHealthAlertThreshold: 90 },
    numpadCommands: { inputAdapter: 'browser', presentation: 'tiles', alwaysConfirm: false, cancelAfterMs: 5000 }
  }
  const result = { address: '112', revision: 1, status: 'accepted', message: 'Opened', command: { navigationHref: '#/galaxy/system' } } as NumpadExecutionResult
  const api = {
    getNumpadSnapshot: vi.fn<PhoenixApi['getNumpadSnapshot']>(async () => numpadTree),
    getModuleSettings: vi.fn(async () => settings),
    executeNumpadAddress: vi.fn<PhoenixApi['executeNumpadAddress']>(async () => result)
  }
  let catalogue: (payload: { revision: number, generatedAt: string }) => void = () => {}
  const events = { subscribe: vi.fn((_name: string, listener: typeof catalogue) => { catalogue = listener; return () => { catalogue = () => {} } }) } as unknown as PhoenixEventHub
  let route: PhoenixRoute = { kind: 'controls', category: 'ship' }
  const listeners = new Set<() => void>()
  const router = {
    getSnapshot: () => route,
    push: vi.fn((next: PhoenixRoute) => { route = next; for (const listener of listeners) listener() }),
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
  } as unknown as PhoenixRouter
  const routeSession = { arm: vi.fn(), acknowledge: vi.fn(), isArmed: () => false, discard: vi.fn(), leave: vi.fn(() => false), navigate: vi.fn() }
  const paints: (() => void)[] = []
  const runtime = new NumpadRuntime(phoenixApiStub(api), events, router, routeSession, notify => { paints.push(notify) })
  return {
    api, events, router, routeSession, runtime, paints, settings, result,
    changed: (revision: number, generatedAt = numpadTree.generatedAt) => catalogue({ revision, generatedAt }),
    key: (digit: string, repeat = false) => runtime.keyDown({ code: `Numpad${digit}`, key: digit, repeat }, true),
    settle: async () => { for (let index = 0; index < 6; index++) await Promise.resolve() }
  }
}
