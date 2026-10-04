import type { ReactElement, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test, vi } from 'vitest'
import { App } from '../apps/web/src/app.js'
import type { PhoenixApplicationServices } from '../apps/web/src/bootstrap/create-application.js'
import type { PhoenixApplicationShellProps } from '../apps/web/src/components/shell/phoenix-application-shell.js'
import type { DesktopWorkspaceProps } from '../apps/web/src/components/shell/desktop-workspace.js'
import { DEFAULT_ROUTE, type InformationRoute, type PhoenixRoute } from '../apps/web/src/application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../apps/web/src/application/navigation/phoenix-router.js'

const state = vi.hoisted(() => ({
  route: undefined as PhoenixRoute | undefined,
  shell: undefined as PhoenixApplicationShellProps | undefined,
  desktop: undefined as DesktopWorkspaceProps | undefined
}))

vi.mock('../apps/web/src/application/navigation/use-phoenix-route.js', () => ({ usePhoenixRoute: () => state.route }))
vi.mock('../apps/web/src/bootstrap/pairing-gate.js', () => ({ PairingGate: ({ children }: { children: ReactNode }) => children }))
vi.mock('../apps/web/src/bootstrap/providers.js', () => ({ PhoenixProviders: ({ children }: { children: ReactNode }) => children }))
vi.mock('../apps/web/src/components/device-presentation.js', () => ({ DevicePresentation: ({ children }: { children: ReactNode }) => children }))
vi.mock('../apps/web/src/components/shell/phoenix-application-shell.js', () => ({
  PhoenixApplicationShell: (props: PhoenixApplicationShellProps) => { state.shell = props; return null }
}))
vi.mock('../apps/web/src/components/shell/desktop-workspace.js', () => ({
  DesktopWorkspace: (props: DesktopWorkspaceProps) => {
    state.desktop = props
    return <nav aria-label={props.informationContextLabel ?? 'Contextual navigation'} />
  }
}))

const application = {
  router: { href: phoenixRouteHash, getRememberedInformationRoute: () => DEFAULT_ROUTE }
} as unknown as PhoenixApplicationServices

function composition(route: PhoenixRoute) {
  state.route = route
  renderToStaticMarkup(<App application={application} />)
  return state.shell!
}

test.each([
  ['commander', 'career', 'Commander views', null],
  ['fleet', 'current-overview', 'Fleet views', '#/fleet/ships/current/overview'],
  ['galaxy', 'system', 'Galaxy views', 'system'],
  ['activities', 'missions', 'Activity views', '#/activities/missions'],
  ['comms', 'inbox', 'Comms views', '#/comms/inbox'],
  ['engineering', 'projects', 'Engineering views', '#/engineering/projects'],
  ['equipment', 'gear', 'Equipment views', null]
] as const)('information composition preserves %s context and feature key', (section, view, label, key) => {
  const route = { kind: 'information', section, view } as InformationRoute
  const shell = composition(route)
  const boundary = shell.information as ReactElement<{ children: ReactElement }>
  expect(shell.informationContextLabel).toBe(label)
  expect(shell.informationContextItems?.length).toBeGreaterThan(0)
  expect(boundary.props.children.key).toBe(key)
  expect(boundary.props.children.props).toMatchObject({ application })
})

test('Galaxy selection changes preserve the view-only key and pass the full route', () => {
  for (const systemName of ['Sol', 'Achenar']) {
    const route: InformationRoute = { kind: 'information', section: 'galaxy', view: 'system', systemName }
    const boundary = composition(route).information as ReactElement<{ children: ReactElement<{ route: InformationRoute }> }>
    expect(boundary.props.children.key).toBe('system')
    expect(boundary.props.children.props.route).toBe(route)
  }
})

test('Equipment selected IDs and Commander feature variants keep their existing props', () => {
  const feature = (route: InformationRoute) => (composition(route).information as ReactElement<{ children: ReactElement }>).props.children
  expect(feature({ kind: 'information', section: 'equipment', view: 'specialists', selectedSpecialistId: 'yi-shen' }).props)
    .toMatchObject({ selectedSpecialistId: 'yi-shen', selectedUpgradeId: undefined, view: 'specialists' })
  expect(feature({ kind: 'information', section: 'equipment', view: 'upgrades', selectedUpgradeId: 'range' }).props)
    .toMatchObject({ selectedUpgradeId: 'range', selectedSpecialistId: undefined, view: 'upgrades' })
  expect(feature({ kind: 'information', section: 'commander', view: 'loadouts' }).props).toMatchObject({ view: 'loadouts' })
  expect(feature(DEFAULT_ROUTE).type).not.toBe(feature({ kind: 'information', section: 'commander', view: 'career' }).type)
})

test('inactive Information workspace keeps its remembered context without mounting a feature', () => {
  const shell = composition({ kind: 'controls', category: 'ship' })
  expect(shell.information).toBeNull()
  expect(shell.informationContextLabel).toBe('Commander views')
})

test.each([undefined, '', 'Custom views'])('shell retains omitted/empty context-label defaults: %j', async label => {
  const { PhoenixApplicationShell } = await vi.importActual<typeof import('../apps/web/src/components/shell/phoenix-application-shell.js')>(
    '../apps/web/src/components/shell/phoenix-application-shell.js'
  )
  const items: NonNullable<PhoenixApplicationShellProps['informationContextItems']> = []
  const markup = renderToStaticMarkup(<PhoenixApplicationShell
    activeDesktop="info" controls={null} copilot={null} information={null} journal={null}
    macros={null} settings={null} telemetry={null} informationRoute={DEFAULT_ROUTE}
    informationContextItems={items} informationContextLabel={label} informationCurrentContext=""
    onNavigateRoute={() => {}} onNavigateWorkspace={() => {}}
  />)
  expect(markup).toContain(`aria-label="${label || 'Contextual navigation'}"`)
  expect(state.desktop?.informationContextLabel).toBe(label || undefined)
  expect(state.desktop?.informationContextItems).toBe(items)
  expect(state.desktop?.informationCurrentContext).toBe('')
})
