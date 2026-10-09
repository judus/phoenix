import type { ReactNode } from 'react'
import { act, create } from 'react-test-renderer'
import type { ReactTestRenderer } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import { App } from '../apps/web/src/app.js'
import type { PhoenixApplicationServices } from '../apps/web/src/bootstrap/create-application.js'
import type { PhoenixApplicationShellProps } from '../apps/web/src/components/shell/phoenix-application-shell.js'
import type { ControlsControllerSnapshot } from '../apps/web/src/features/controls/use-controls-controller.js'
import { firstControlCategory } from '../apps/web/src/features/controls/controls-navigation.js'
import { DEFAULT_ROUTE, defaultRouteForWorkspace } from '../apps/web/src/application/navigation/phoenix-route.js'
import { phoenixRouteHash, type PhoenixRouter } from '../apps/web/src/application/navigation/phoenix-router.js'
import { workspaceItems } from '../apps/web/src/components/shell/navigation-model.js'
import { DEFAULT_CONTROL_DECK_CONFIGURATION } from '../apps/server/src/infrastructure/default-control-deck-configuration.js'

const state = vi.hoisted(() => ({
  controls: { status: 'loading' } as ControlsControllerSnapshot,
  shell: undefined as PhoenixApplicationShellProps | undefined
}))
vi.mock('../apps/web/src/bootstrap/pairing-gate.js', () => ({ PairingGate: ({ children }: { children: ReactNode }) => children }))
vi.mock('../apps/web/src/bootstrap/providers.js', () => ({ PhoenixProviders: ({ children }: { children: ReactNode }) => children }))
vi.mock('../apps/web/src/components/device-presentation.js', () => ({ DevicePresentation: ({ children }: { children: ReactNode }) => children }))
vi.mock('../apps/web/src/features/controls/use-controls-controller.js', () => ({ useControlsController: () => state.controls }))
vi.mock('../apps/web/src/components/shell/phoenix-application-shell.js', () => ({
  PhoenixApplicationShell: (props: PhoenixApplicationShellProps) => { state.shell = props; return null }
}))
beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

const configuration = {
  ...DEFAULT_CONTROL_DECK_CONFIGURATION,
  decks: [...DEFAULT_CONTROL_DECK_CONFIGURATION.decks].reverse()
}

test('the initial Controls destination follows saved deck order', () => {
  expect(firstControlCategory(DEFAULT_CONTROL_DECK_CONFIGURATION)).toBe('quick')
  expect(`phoenix:${firstControlCategory(configuration)}`).toBe(configuration.decks[0].context)
  expect(firstControlCategory()).toBe('quick')
})

test('workspace links reflect recalled Controls and Copilot pages', () => {
  const items = workspaceItems(DEFAULT_ROUTE, { kind: 'controls', category: 'combat' }, { kind: 'copilot', view: 'profiles' })
  expect(items.map(item => item.href)).toEqual(['#/controls/combat', '#/commander/dashboard', '#/copilot/profiles'])
})

test.each([false, true])('CTR waits for initial deck settings; cancelled=%s', async cancelled => {
  state.controls = { status: 'loading' }
  const push = vi.fn()
  const router: PhoenixRouter = {
      getSnapshot: () => DEFAULT_ROUTE,
      getRememberedInformationRoute: () => DEFAULT_ROUTE,
      subscribe: () => () => {},
      href: phoenixRouteHash,
      routeForWorkspace: (workspace, category = 'quick') => workspace === 'controls'
        ? { kind: 'controls', category }
        : defaultRouteForWorkspace(workspace),
      push,
      replace: vi.fn()
  }
  const application = { router } as unknown as PhoenixApplicationServices
  let renderer!: ReactTestRenderer
  await act(async () => { renderer = create(<App application={application} />) })
  await act(async () => state.shell!.onNavigateWorkspace('controls'))
  expect(push).not.toHaveBeenCalled()
  if (cancelled) await act(async () => state.shell!.onNavigateWorkspace('copilot'))
  state.controls = { status: 'ready', configuration }
  await act(async () => renderer.update(<App application={application} />))
  expect(push).toHaveBeenCalledExactlyOnceWith(cancelled
    ? { kind: 'copilot', view: 'chat' }
    : { kind: 'controls', category: firstControlCategory(configuration) })
  await act(async () => renderer.unmount())
})
