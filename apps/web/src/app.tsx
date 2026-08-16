import { useMemo } from 'react'
import { PlaceholderPage } from './components/shell/placeholder-page.js'
import { PhoenixApplicationShell } from './components/shell/phoenix-application-shell.js'
import { isInformationRoute, workspaceForRoute } from './application/navigation/phoenix-route.js'
import type { PhoenixRouter } from './application/navigation/phoenix-router.js'
import { usePhoenixRoute } from './application/navigation/use-phoenix-route.js'
import { usePhoenixEventConnection } from './application/events/use-phoenix-event-connection.js'
import { useRuntimeState } from './application/runtime/use-runtime-state.js'
import type { PhoenixApplicationServices } from './bootstrap/create-application.js'
import { PairingGate } from './bootstrap/pairing-gate.js'
import { PhoenixProviders } from './bootstrap/providers.js'
import { useCopilotVoice } from './features/copilot/copilot-voice-provider.js'
import { DashboardPage } from './features/dashboard/dashboard-page.js'
import { createDashboardViewModel } from './features/dashboard/dashboard-view-model.js'
import { useDashboardController } from './features/dashboard/use-dashboard-controller.js'
import { CommanderPage } from './features/commander/commander-page.js'
import { createCommanderViewModel } from './features/commander/commander-view-model.js'
import { commanderContextForRoute, commanderNavigationItems } from './features/commander/commander-navigation.js'
import { FleetPage } from './features/fleet/fleet-page.js'
import { fleetContextForRoute, fleetNavigationItems } from './features/fleet/fleet-navigation.js'
import { useFleetController } from './features/fleet/use-fleet-controller.js'

export function App({ application }: { application: PhoenixApplicationServices }) {
  return (
    <PairingGate api={application.api}>
      <PhoenixProviders application={application}>
        <PhoenixApplication application={application} />
      </PhoenixProviders>
    </PairingGate>
  )
}

function PhoenixApplication({ application }: { application: PhoenixApplicationServices }) {
  const { router } = application
  const route = usePhoenixRoute(router)
  const informationRoute = isInformationRoute(route) ? route : router.getRememberedInformationRoute()
  const commanderRoute = isInformationRoute(route) && route.section === 'commander' ? route : undefined
  const fleetRoute = isInformationRoute(route) && route.section === 'fleet' ? route : undefined
  const informationContext = commanderRoute
    ? {
        informationContextItems: commanderNavigationItems,
        informationContextLabel: 'Commander views',
        informationCurrentContext: commanderContextForRoute(commanderRoute)
      }
    : fleetRoute
      ? {
          informationContextItems: fleetNavigationItems,
          informationContextLabel: 'Fleet views',
          informationCurrentContext: fleetContextForRoute(fleetRoute)
        }
      : undefined

  return (
    <PhoenixApplicationShell
      activeDesktop={workspaceForRoute(route)}
      informationRoute={informationRoute}
      {...informationContext}
      onNavigateRoute={router.push}
      onNavigateWorkspace={(workspace) => router.push(router.routeForWorkspace(workspace))}
      controls={<PlaceholderPage context="Controls" title="Flight controls" description="Ship and game command surfaces" />}
      copilot={<PlaceholderPage context="Copilot" title="Flight assistant" description="Conversation and current task context" />}
      developer={<PlaceholderPage context="Developer" title="Developer tools" description="Runtime inspection and diagnostics" />}
      information={isDashboardRoute(route)
        ? <DashboardFeature application={application} />
        : commanderRoute
          ? <CommanderFeature application={application} view={commanderRoute.view} />
          : fleetRoute
            ? <FleetFeature application={application} route={fleetRoute} />
            : null}
      journal={<PlaceholderPage context="Journal" title="Event log" description="Recent game and application events" />}
      macros={<PlaceholderPage context="Macros" title="Command macros" description="Stored command sequences" />}
      settings={<PlaceholderPage context="Settings" title="Application settings" description="Display, connection and control preferences" />}
      telemetry={<PlaceholderPage context="Telemetry" title="Numpad" description="Telemetry and direct-entry controls" />}
    />
  )
}

function FleetFeature({ application, route }: {
  application: PhoenixApplicationServices
  route: Extract<ReturnType<PhoenixRouter['getSnapshot']>, { kind: 'information', section: 'fleet' }>
}) {
  const runtime = useRuntimeState(application.runtime)
  const controller = useFleetController(application.api, application.events, route.view)
  return <FleetPage controller={controller} onNavigate={application.router.push} route={route} runtime={runtime} />
}

function CommanderFeature({ application, view }: {
  application: PhoenixApplicationServices
  view: 'overview' | 'inventory' | 'progress'
}) {
  const runtime = useRuntimeState(application.runtime)
  const model = useMemo(
    () => runtime.status === 'ready' ? createCommanderViewModel(runtime.state) : undefined,
    [runtime]
  )
  return <CommanderPage model={model} runtime={runtime} view={view} />
}

function DashboardFeature({ application }: { application: PhoenixApplicationServices }) {
  const controller = useDashboardController(application.api, application.events)
  const runtime = useRuntimeState(application.runtime)
  const eventConnection = usePhoenixEventConnection(application.events)
  const voice = useCopilotVoice()
  const model = useMemo(() => createDashboardViewModel(
    runtime.status === 'ready' ? runtime.state : undefined,
    controller.route,
    controller.activity
  ), [controller.activity, controller.route, runtime])

  return (
    <DashboardPage
      actions={controller.actions}
      controller={controller}
      eventConnection={eventConnection}
      hrefFor={application.router.href}
      model={model}
      onExecuteAction={actionId => application.api.executeAction(actionId, 'tap')}
      onNavigate={application.router.push}
      runtime={runtime}
      voice={{
        connected: voice.connected,
        connect: voice.connect,
        disconnect: voice.disconnect,
        ...(voice.error === undefined ? {} : { error: voice.error }),
        mark: voice.activeProfile.mark,
        name: voice.activeProfile.name,
        status: voice.status,
        transitioning: voice.transitioning
      }}
    />
  )
}

function isDashboardRoute(route: ReturnType<PhoenixRouter['getSnapshot']>): boolean {
  return route.kind === 'information' && route.section === 'home' && route.view === 'overview'
}
