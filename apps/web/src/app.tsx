import { useMemo, useState } from 'react'
import type { ApplicationNavigationItem } from '@phoenix/ui'
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
import { CopilotFeature } from './features/copilot/copilot-feature.js'
import { copilotContext, copilotNavigationItems } from './features/copilot/copilot-navigation.js'
import { DashboardPage } from './features/dashboard/dashboard-page.js'
import { createDashboardViewModel } from './features/dashboard/dashboard-view-model.js'
import { useDashboardController } from './features/dashboard/use-dashboard-controller.js'
import { CommanderPage } from './features/commander/commander-page.js'
import { createCommanderViewModel } from './features/commander/commander-view-model.js'
import { commanderContextForRoute, commanderNavigationItems } from './features/commander/commander-navigation.js'
import { FleetPage } from './features/fleet/fleet-page.js'
import { fleetContextForRoute, fleetNavigationItems } from './features/fleet/fleet-navigation.js'
import { useFleetController } from './features/fleet/use-fleet-controller.js'
import { GalaxyPage } from './features/galaxy/galaxy-page.js'
import { galaxyContextForRoute, galaxyNavigationItems } from './features/galaxy/galaxy-navigation.js'
import { useGalaxyController } from './features/galaxy/use-galaxy-controller.js'
import { ActivitiesPage } from './features/activities/activities-page.js'
import { activitiesContextForRoute, activitiesNavigationItemsForRoute } from './features/activities/activities-navigation.js'
import { useActivitiesController } from './features/activities/use-activities-controller.js'
import { CommsPage } from './features/comms/comms-page.js'
import { commsContextForRoute, commsNavigationItems } from './features/comms/comms-navigation.js'
import { useCommsController } from './features/comms/use-comms-controller.js'
import { EngineeringPage } from './features/engineering/engineering-page.js'
import { engineeringContextForRoute, engineeringNavigationItems } from './features/engineering/engineering-navigation.js'
import { useEngineeringController } from './features/engineering/use-engineering-controller.js'
import { ControlsPage } from './features/controls/controls-page.js'
import { controlsContext, controlsNavigationItems } from './features/controls/controls-navigation.js'
import { useControlsController } from './features/controls/use-controls-controller.js'
import { useMacroRuntime } from './features/macros/macro-runtime-provider.js'
import { MacrosPage } from './features/macros/macros-page.js'
import { NumpadPage } from './features/numpad/numpad-page.js'
import { numpadContext, numpadNavigationItems } from './features/numpad/numpad-navigation.js'
import { useNumpadController } from './features/numpad/use-numpad-controller.js'
import { JournalPage } from './features/journal/journal-page.js'
import { useJournalController } from './features/journal/use-journal-controller.js'
import { CreditsPage } from './features/journal/credits-page.js'
import { journalContext, journalNavigationItems } from './features/journal/journal-navigation.js'
import { SettingsPage } from './features/settings/settings-page.js'
import { settingsContext, settingsNavigationItems } from './features/settings/settings-navigation.js'

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
  const galaxyRoute = isInformationRoute(route) && route.section === 'galaxy' ? route : undefined
  const activitiesRoute = isInformationRoute(route) && route.section === 'activities' ? route : undefined
  const commsRoute = isInformationRoute(route) && route.section === 'comms' ? route : undefined
  const engineeringRoute = isInformationRoute(route) && route.section === 'engineering' ? route : undefined
  const controlsRoute = route.kind === 'controls' ? route : undefined
  const numpadRoute = route.kind === 'numpad' ? route : undefined
  const logRoute = route.kind === 'journal' || route.kind === 'developer' ? route : undefined
  const [controlsEditing, setControlsEditing] = useState(false)
  const controlsRailItems = useMemo<ApplicationNavigationItem[]>(() => [
    ...controlsNavigationItems,
    {
      id: 'edit-layout',
      kind: 'action',
      label: controlsEditing ? 'Cancel layout editing' : 'Edit layout',
      shortLabel: 'EDT',
      pressed: controlsEditing
    }
  ], [controlsEditing])
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
      : galaxyRoute
        ? {
            informationContextItems: galaxyNavigationItems,
            informationContextLabel: 'Galaxy views',
            informationCurrentContext: galaxyContextForRoute(galaxyRoute)
          }
        : activitiesRoute
          ? {
              informationContextItems: activitiesNavigationItemsForRoute(activitiesRoute),
              informationContextLabel: 'Activity views',
              informationCurrentContext: activitiesContextForRoute(activitiesRoute)
            }
          : commsRoute
            ? {
                informationContextItems: commsNavigationItems,
                informationContextLabel: 'Comms views',
                informationCurrentContext: commsContextForRoute(commsRoute)
              }
            : engineeringRoute
              ? {
                  informationContextItems: engineeringNavigationItems,
                  informationContextLabel: 'Engineering views',
                  informationCurrentContext: engineeringContextForRoute(engineeringRoute)
                }
      : undefined

  return (
    <PhoenixApplicationShell
      activeDesktop={workspaceForRoute(route)}
      informationRoute={informationRoute}
      {...informationContext}
      onNavigateRoute={router.push}
      onNavigateWorkspace={(workspace) => router.push(router.routeForWorkspace(workspace))}
      controls={<ControlsFeature application={application} category={controlsRoute?.category ?? 'ship'} editing={controlsEditing} onEditingChange={setControlsEditing} />}
      controlsContextItems={controlsRailItems}
      controlsCurrentContext={controlsContext(controlsRoute?.category ?? 'ship')}
      onControlsContextAction={(item) => { if (item.id === 'edit-layout') setControlsEditing(current => !current) }}
      copilot={<CopilotFeature application={application} view={route.kind === 'copilot' ? route.view : 'chat'} />}
      copilotContextItems={copilotNavigationItems}
      copilotCurrentContext={copilotContext(route)}
      information={isDashboardRoute(route)
        ? <DashboardFeature application={application} />
        : commanderRoute
          ? <CommanderFeature application={application} view={commanderRoute.view} />
          : fleetRoute
            ? <FleetFeature application={application} route={fleetRoute} />
            : galaxyRoute
              ? <GalaxyFeature application={application} route={galaxyRoute} />
              : activitiesRoute
                ? <ActivitiesFeature application={application} route={activitiesRoute} />
                : commsRoute
                  ? <CommsFeature application={application} route={commsRoute} />
                  : engineeringRoute
                    ? <EngineeringFeature application={application} route={engineeringRoute} />
            : null}
      journal={logRoute?.kind === 'developer'
        ? <PlaceholderPage context="Log · Developer" title="Developer tools" description="Runtime inspection and diagnostics" />
        : logRoute?.view === 'credits'
          ? <CreditsPage />
          : <JournalFeature application={application} />}
      journalContextItems={journalNavigationItems}
      journalCurrentContext={journalContext(route)}
      macros={<MacrosFeature />}
      settings={<SettingsPage
        api={application.api}
        devicePreferences={application.devicePreferences}
        view={route.kind === 'settings' ? route.view : 'copilot'}
      />}
      settingsContextItems={settingsNavigationItems}
      settingsCurrentContext={settingsContext(route)}
      telemetry={<NumpadFeature application={application} view={numpadRoute?.view ?? 'navigator'} />}
      telemetryContextItems={numpadNavigationItems}
      telemetryCurrentContext={numpadContext(route)}
    />
  )
}

function MacrosFeature() {
  return <MacrosPage runtime={useMacroRuntime()} />
}

function NumpadFeature({ application, view }: { application: PhoenixApplicationServices, view: 'navigator' | 'shortcuts' }) {
  return <NumpadPage api={application.api} controller={useNumpadController(application.api, application.events)} view={view} />
}

function JournalFeature({ application }: { application: PhoenixApplicationServices }) {
  return <JournalPage controller={useJournalController(application.api, application.events)} />
}

function ControlsFeature({ application, category, editing, onEditingChange }: {
  application: PhoenixApplicationServices
  category: Extract<ReturnType<PhoenixRouter['getSnapshot']>, { kind: 'controls' }>['category']
  editing: boolean
  onEditingChange(editing: boolean): void
}) {
  const controller = useControlsController(application.api, application.events)
  const runtime = useRuntimeState(application.runtime)
  const macros = useMacroRuntime()
  return <ControlsPage
    category={category}
    controller={controller}
    editing={editing}
    macros={macros}
    onEditingChange={onEditingChange}
    runtime={runtime.status === 'ready' ? runtime.state : undefined}
    onExecuteAction={(actionId, operation) => application.api.executeAction(actionId, operation)}
    onSaveLayout={layout => application.api.saveControlLayout(layout)}
  />
}

function EngineeringFeature({ application, route }: {
  application: PhoenixApplicationServices
  route: Extract<ReturnType<PhoenixRouter['getSnapshot']>, { kind: 'information', section: 'engineering' }>
}) {
  const runtime = useRuntimeState(application.runtime)
  const selectedBlueprintSymbol = route.view === 'blueprints' ? route.selectedBlueprintSymbol : undefined
  const controller = useEngineeringController(
    application.api,
    route.view,
    selectedBlueprintSymbol,
    runtime.status === 'ready' ? runtime.state.revision : undefined
  )
  return <EngineeringPage controller={controller} selectedBlueprintSymbol={selectedBlueprintSymbol} view={route.view} />
}

function CommsFeature({ application, route }: {
  application: PhoenixApplicationServices
  route: Extract<ReturnType<PhoenixRouter['getSnapshot']>, { kind: 'information', section: 'comms' }>
}) {
  const controller = useCommsController(application.api, application.events, route.view)
  return <CommsPage
    controller={controller}
    onExecuteAction={actionId => application.api.executeAction(actionId, 'tap')}
    view={route.view}
  />
}

function ActivitiesFeature({ application, route }: {
  application: PhoenixApplicationServices
  route: Extract<ReturnType<PhoenixRouter['getSnapshot']>, { kind: 'information', section: 'activities' }>
}) {
  const controller = useActivitiesController(application.api, application.events, route.view, route.fixture)
  return <ActivitiesPage controller={controller} view={route.view} />
}

function GalaxyFeature({ application, route }: {
  application: PhoenixApplicationServices
  route: Extract<ReturnType<PhoenixRouter['getSnapshot']>, { kind: 'information', section: 'galaxy' }>
}) {
  const runtime = useRuntimeState(application.runtime)
  const systemName = route.view === 'system'
    ? route.systemName ?? (runtime.status === 'ready' ? runtime.state.system.name ?? undefined : undefined)
    : undefined
  const controller = useGalaxyController(application.api, application.events, route.view, systemName)
  return <GalaxyPage api={application.api} controller={controller} onNavigate={application.router.push} route={route} runtime={runtime} />
}

function FleetFeature({ application, route }: {
  application: PhoenixApplicationServices
  route: Extract<ReturnType<PhoenixRouter['getSnapshot']>, { kind: 'information', section: 'fleet' }>
}) {
  const runtime = useRuntimeState(application.runtime)
  const controller = useFleetController(application.api, application.events, route.view)
  return <FleetPage
    controller={controller}
    onExecuteAction={actionId => application.api.executeAction(actionId, 'tap')}
    onNavigate={application.router.push}
    route={route}
    runtime={runtime}
  />
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
