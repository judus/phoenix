import { useEffect } from 'react'
import { act, create } from 'react-test-renderer'
import type { ReactTestRenderer } from 'react-test-renderer'
import { beforeAll, describe, expect, test, vi } from 'vitest'
import type { Deskplane, DeskplaneSnapshot } from 'deskplane'
import type { DeskplaneViewportProps } from 'deskplane/react'
import { BrowserPhoenixRouter } from '../apps/web/src/platform/routing/browser-phoenix-router.js'
import {
  isInformationRoute,
  workspaceForRoute
} from '../apps/web/src/application/navigation/phoenix-route.js'
import { usePhoenixRoute } from '../apps/web/src/application/navigation/use-phoenix-route.js'

const deskplaneHarness = vi.hoisted(() => ({
  props: undefined as DeskplaneViewportProps | undefined,
  controller: undefined as Deskplane | undefined
}))

vi.mock('deskplane/react', () => ({
  DeskplaneViewport(props: DeskplaneViewportProps) {
    deskplaneHarness.props = props
    useEffect(() => props.onReady?.(requiredController()), [])
    return <div data-testid="deskplane-viewport" />
  }
}))

import { DesktopWorkspace } from '../apps/web/src/components/shell/desktop-workspace.js'

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

describe('DesktopWorkspace routing integration', () => {
  test('routes drive Deskplane and genuine Deskplane gestures drive the router once', async () => {
    const browser = new FakeBrowserWindow('#/')
    const router = new BrowserPhoenixRouter(browser as unknown as Window)
    const goTo = vi.fn(async (desktop: string) => {
      deskplaneHarness.props?.onSnapshotChange?.(snapshot(desktop))
      return true
    })
    deskplaneHarness.controller = createDeskplaneController(goTo)
    let renderer: ReactTestRenderer | undefined

    await act(async () => {
      renderer = create(<RoutedDesktopWorkspace router={router} />)
    })
    goTo.mockClear()

    await act(async () => {
      router.push({ kind: 'settings', view: 'copilot' })
    })

    expect(goTo).toHaveBeenCalledTimes(1)
    expect(goTo).toHaveBeenCalledWith('settings')
    expect(router.getSnapshot()).toEqual({ kind: 'settings', view: 'copilot' })
    expect(browser.historyCalls).toEqual([['push', '#/settings/copilot']])

    await act(async () => {
      deskplaneHarness.props?.onSnapshotChange?.(snapshot('info'))
    })

    expect(router.getSnapshot()).toEqual({ kind: 'information', section: 'home', view: 'overview' })
    expect(browser.historyCalls).toEqual([
      ['push', '#/settings/copilot'],
      ['push', '#/']
    ])

    await act(async () => renderer?.unmount())
  })
})

function RoutedDesktopWorkspace({ router }: { router: BrowserPhoenixRouter }) {
  const route = usePhoenixRoute(router)
  const informationRoute = isInformationRoute(route) ? route : router.getRememberedInformationRoute()
  return (
    <DesktopWorkspace
      activeDesktop={workspaceForRoute(route)}
      controls={null}
      copilot={null}
      information={null}
      informationRoute={informationRoute}
      journal={null}
      macros={null}
      onNavigateRoute={router.push}
      onNavigateWorkspace={(workspace) => router.push(router.routeForWorkspace(workspace))}
      settings={null}
      telemetry={null}
    />
  )
}

function requiredController(): Deskplane {
  if (!deskplaneHarness.controller) throw new Error('Deskplane controller is not configured.')
  return deskplaneHarness.controller
}

function createDeskplaneController(goTo: Deskplane['goTo']): Deskplane {
  return {
    snapshot: snapshot('info'),
    goTo,
    async move() { return false },
    isActive(desktopId) { return desktopId === 'info' },
    subscribe() { return () => undefined },
    destroy() {}
  }
}

function snapshot(activeDesktopId: string): DeskplaneSnapshot {
  return {
    activeDesktopId,
    activeRowId: activeDesktopId === 'settings' ? 'system' : 'workspaces',
    activeDesktopByRow: {
      utilities: 'telemetry',
      workspaces: activeDesktopId === 'info' ? 'info' : 'controls',
      system: activeDesktopId === 'settings' ? 'settings' : 'developer'
    },
    isAnimating: false
  }
}

class FakeBrowserWindow {
  readonly location: { hash: string }
  readonly sessionStorage = new MemoryStorage()
  readonly historyCalls: Array<['push' | 'replace', string]> = []
  readonly history = {
    pushState: (_data: unknown, _unused: string, url?: string | URL | null) => this.setHistory('push', url),
    replaceState: (_data: unknown, _unused: string, url?: string | URL | null) => this.setHistory('replace', url)
  }
  readonly #listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()

  constructor(hash: string) {
    this.location = { hash }
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const listeners = this.#listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.#listeners.get(type)?.delete(listener)
  }

  private setHistory(method: 'push' | 'replace', url?: string | URL | null): void {
    const destination = String(url ?? '')
    this.location.hash = destination
    this.historyCalls.push([method, destination])
  }
}

class MemoryStorage {
  readonly #values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value)
  }
}
