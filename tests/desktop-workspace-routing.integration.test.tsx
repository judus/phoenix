import { renderWithAct } from './support/render-with-act.js'
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
    return <div data-testid="deskplane-viewport">{props.rows.flatMap(row => row.desktops.map(desktop => <div key={desktop.id}>{desktop.children}</div>))}</div>
  }
}))

import { DesktopWorkspace } from '../apps/web/src/components/shell/desktop-workspace.js'
import { utilityItems, workspaceItems } from '../apps/web/src/components/shell/navigation-model.js'

beforeAll(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

describe('DesktopWorkspace routing integration', () => {
  test('hidden DEV is absent from both navigation and the Deskplane row', async () => {
    const router = new BrowserPhoenixRouter(new FakeBrowserWindow('#/settings/general') as unknown as Window)
    deskplaneHarness.controller = createDeskplaneController(vi.fn(async () => true))
    const renderer = await renderWithAct(<RoutedDesktopWorkspace router={router} showDeveloper={false} />)
    try {
      expect(deskplaneHarness.props?.rows[0].desktops.map(desktop => desktop.id)).toEqual(['telemetry'])
      expect(workspaceItems(router.getRememberedInformationRoute()).some(item => item.id === 'developer')).toBe(false)
      expect(workspaceItems(router.getRememberedInformationRoute()).some(item => item.id === 'telemetry')).toBe(false)
      expect(deskplaneHarness.props?.rows[1].desktops.map(desktop => desktop.id))
        .toEqual(['controls', 'info', 'journal', 'copilot', 'settings'])
    } finally { await act(async () => renderer.unmount()) }
  })
  test('swiping to LOG recalls the Notes editor and subsequent Log pages', async () => {
    const browser = new FakeBrowserWindow('#/notes?edit=note-id')
    const router = new BrowserPhoenixRouter(browser as unknown as Window)
    const goTo = vi.fn(async () => true)
    deskplaneHarness.controller = createDeskplaneController(goTo)
    const renderer = await renderWithAct(<RoutedDesktopWorkspace router={router} />)
    try {
      await act(async () => router.push({ kind: 'copilot', view: 'chat' }))
      await act(async () => deskplaneHarness.props?.onSnapshotChange?.(snapshot('journal')))
      expect(router.getSnapshot()).toEqual({ kind: 'notes', noteId: 'note-id' })
      expect(router.routeForWorkspace('journal')).toEqual({ kind: 'notes', noteId: 'note-id' })
      await act(async () => router.push({ kind: 'information', section: 'galaxy', view: 'atlas' }))
      const restored = new BrowserPhoenixRouter(browser as unknown as Window)
      expect(restored.routeForWorkspace('journal')).toEqual({ kind: 'notes', noteId: 'note-id' })
      restored.push({ kind: 'journal', view: 'credits' })
      restored.push({ kind: 'copilot', view: 'chat' })
      expect(restored.routeForWorkspace('journal')).toEqual({ kind: 'journal', view: 'credits' })
    } finally { await act(async () => renderer.unmount()) }
  })

  test('routes drive Deskplane and genuine Deskplane gestures drive the router once', async () => {
    const browser = new FakeBrowserWindow('#/')
    const router = new BrowserPhoenixRouter(browser as unknown as Window)
    const goTo = vi.fn(async (desktop: string) => {
      deskplaneHarness.props?.onSnapshotChange?.(snapshot(desktop))
      return true
    })
    deskplaneHarness.controller = createDeskplaneController(goTo)
    const renderer = await renderWithAct(<RoutedDesktopWorkspace router={router} />)
    expect(deskplaneHarness.props?.rows.map(row => row.id)).toEqual(['utilities', 'workspaces'])
    expect(deskplaneHarness.props?.rows[0].desktops.map(desktop => desktop.id))
      .toEqual(['telemetry'])
    expect(utilityItems({ active: false, supported: true }).filter(item => 'route' in item).map(item => item.id))
      .toEqual([])
    expect(deskplaneHarness.props?.rows[1].desktops.map(desktop => desktop.id))
      .toEqual(['controls', 'info', 'journal', 'copilot', 'settings', 'developer'])
    expect(renderer.root.findAll(element => element.props['data-deskplane-swipe-zone'] === 'horizontal')).toHaveLength(7)
    goTo.mockClear()

    await act(async () => {
      router.push({ kind: 'developer', view: 'journal' })
    })
    expect(goTo).toHaveBeenLastCalledWith('developer')
    await act(async () => {
      router.replace({ kind: 'information', section: 'commander', view: 'dashboard' })
    })
    browser.historyCalls.length = 1
    goTo.mockClear()

    await act(async () => {
      router.push({ kind: 'settings', view: 'general' })
    })

    expect(goTo).toHaveBeenCalledTimes(1)
    expect(goTo).toHaveBeenCalledWith('settings')
    expect(router.getSnapshot()).toEqual({ kind: 'settings', view: 'general' })
    expect(browser.historyCalls).toEqual([
      ['replace', '#/commander/dashboard'],
      ['push', '#/settings/general']
    ])

    await act(async () => {
      deskplaneHarness.props?.onSnapshotChange?.(snapshot('info'))
    })

    expect(router.getSnapshot()).toEqual({ kind: 'information', section: 'commander', view: 'dashboard' })
    expect(browser.historyCalls).toEqual([
      ['replace', '#/commander/dashboard'],
      ['push', '#/settings/general'],
      ['push', '#/commander/dashboard']
    ])

    for (const workspace of ['journal', 'settings', 'developer', 'settings', 'journal']) {
      await act(async () => {
        deskplaneHarness.props?.onSnapshotChange?.(snapshot(workspace))
      })
      expect(workspaceForRoute(router.getSnapshot())).toBe(workspace)
    }
    expect(router.getSnapshot()).toEqual({ kind: 'notes' })

    await act(async () => renderer?.unmount())
  })
})

function RoutedDesktopWorkspace({ router, showDeveloper = true }: { router: BrowserPhoenixRouter, showDeveloper?: boolean }) {
  const route = usePhoenixRoute(router)
  const informationRoute = isInformationRoute(route) ? route : router.getRememberedInformationRoute()
  return (
    <DesktopWorkspace
      activeDesktop={workspaceForRoute(route)}
      showDeveloper={showDeveloper}
      controls={null}
      copilot={null}
      information={null}
      informationRoute={informationRoute}
      journal={null}
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
  const utilities = activeDesktopId === 'telemetry'
  return {
    activeDesktopId,
    activeRowId: utilities ? 'utilities' : 'workspaces',
    activeDesktopByRow: {
      utilities: utilities ? activeDesktopId : 'telemetry',
      workspaces: utilities ? 'info' : activeDesktopId
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
