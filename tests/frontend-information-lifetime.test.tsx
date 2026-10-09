import { renderWithAct } from './support/render-with-act.js'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { act, create } from 'react-test-renderer'
import { beforeAll, expect, test, vi } from 'vitest'
import { App } from '../apps/web/src/app.js'
import type { PhoenixApplicationServices } from '../apps/web/src/bootstrap/create-application.js'
import type { PhoenixApplicationShellProps } from '../apps/web/src/components/shell/phoenix-application-shell.js'
import { defaultRouteForWorkspace, type PhoenixRoute, type InformationRoute } from '../apps/web/src/application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../apps/web/src/application/navigation/phoenix-router.js'

const lifecycle = vi.hoisted(() => ({ next: 0, mounted: [] as number[], unmounted: [] as number[] }))

function PageProbe() {
  useEffect(() => {
    const instance = ++lifecycle.next
    lifecycle.mounted.push(instance)
    return () => { lifecycle.unmounted.push(instance) }
  }, [])
  return null
}

vi.mock('../apps/web/src/bootstrap/pairing-gate.js', () => ({ PairingGate: ({ children }: { children: ReactNode }) => children }))
vi.mock('../apps/web/src/bootstrap/providers.js', () => ({ PhoenixProviders: ({ children }: { children: ReactNode }) => children }))
vi.mock('../apps/web/src/components/device-presentation.js', () => ({ DevicePresentation: ({ children }: { children: ReactNode }) => children }))
vi.mock('../apps/web/src/components/shell/phoenix-application-shell.js', () => ({
  PhoenixApplicationShell: ({ information }: PhoenixApplicationShellProps) => information
}))
vi.mock('../apps/web/src/application/runtime/use-runtime-state.js', () => ({ useRuntimeState: () => ({ status: 'idle' }) }))
vi.mock('../apps/web/src/features/galaxy/use-galaxy-controller.js', () => ({ useGalaxyController: () => ({ status: 'idle' }) }))
vi.mock('../apps/web/src/features/fleet/use-fleet-controller.js', () => ({ useFleetController: () => ({ status: 'idle' }) }))
vi.mock('../apps/web/src/features/controls/use-controls-controller.js', () => ({ useControlsController: () => ({ status: 'loading' }) }))
vi.mock('../apps/web/src/features/galaxy/galaxy-page.js', () => ({ GalaxyPage: () => <PageProbe /> }))
vi.mock('../apps/web/src/features/fleet/fleet-page.js', () => ({ FleetPage: () => <PageProbe /> }))

beforeAll(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }) })

test('mounted App preserves Galaxy view instances, href-keyed Fleet remounts and workspace unmounts', async () => {
  let route: PhoenixRoute = { kind: 'information', section: 'galaxy', view: 'system', systemName: 'Sol' }
  let remembered: InformationRoute = route
  const listeners = new Set<() => void>()
  const application = {
    router: {
      getSnapshot: () => route,
      getRememberedInformationRoute: () => remembered,
      href: phoenixRouteHash,
      routeForWorkspace: defaultRouteForWorkspace,
      subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener) }
    }
  } as unknown as PhoenixApplicationServices
  const navigate = async (next: PhoenixRoute) => {
    await act(async () => {
      route = next
      if (next.kind === 'information') remembered = next
      for (const listener of listeners) listener()
    })
  }
  const renderer = await renderWithAct(<App application={application} />)
  expect(lifecycle.mounted).toEqual([1])

  await navigate({ kind: 'information', section: 'galaxy', view: 'system', systemName: 'Achenar' })
  expect(lifecycle.mounted).toEqual([1])
  expect(lifecycle.unmounted).toEqual([])

  await navigate({ kind: 'information', section: 'galaxy', view: 'route' })
  expect(lifecycle.mounted).toEqual([1, 2])
  expect(lifecycle.unmounted).toEqual([1])

  await navigate({ kind: 'information', section: 'fleet', view: 'catalogue', selectedShipId: 'python' })
  await navigate({ kind: 'information', section: 'fleet', view: 'catalogue', selectedShipId: 'mandalay' })
  expect(lifecycle.mounted).toEqual([1, 2, 3, 4])
  expect(lifecycle.unmounted).toEqual([1, 2, 3])

  await navigate({ kind: 'controls', category: 'ship' })
  expect(lifecycle.unmounted).toEqual([1, 2, 3, 4])
  await navigate(remembered)
  expect(lifecycle.mounted).toEqual([1, 2, 3, 4, 5])
  await act(async () => renderer.unmount())
  expect(lifecycle.unmounted).toEqual([1, 2, 3, 4, 5])
  expect(listeners.size).toBe(0)
})
