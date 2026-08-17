import { lazy, memo, Suspense, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { copilotContext, copilotNavigationItems } from './features/copilot/copilot-navigation.js'
import { createDashboardViewModel } from './features/dashboard/dashboard-view-model.js'
import { useDashboardController } from './features/dashboard/use-dashboard-controller.js'
import { createCommanderViewModel } from './features/commander/commander-view-model.js'
import { commanderContextForRoute, commanderNavigationItems } from './features/commander/commander-navigation.js'
import { fleetContextForRoute, fleetNavigationItems } from './features/fleet/fleet-navigation.js'
import { useFleetController } from './features/fleet/use-fleet-controller.js'
import { galaxyContextForRoute, galaxyNavigationItems } from './features/galaxy/galaxy-navigation.js'
import { useGalaxyController } from './features/galaxy/use-galaxy-controller.js'
import { activitiesContextForRoute, activitiesNavigationItemsForRoute } from './features/activities/activities-navigation.js'
import { useActivitiesController } from './features/activities/use-activities-controller.js'
import { commsContextForRoute, commsNavigationItems } from './features/comms/comms-navigation.js'
import { useCommsController } from './features/comms/use-comms-controller.js'
import { engineeringContextForRoute, engineeringNavigationItems } from './features/engineering/engineering-navigation.js'
import { useEngineeringController } from './features/engineering/use-engineering-controller.js'
import { controlsContext, controlsNavigationItems } from './features/controls/controls-navigation.js'
import { useControlsController } from './features/controls/use-controls-controller.js'
import { useMacroRuntime } from './features/macros/macro-runtime-provider.js'
import { numpadContext, numpadNavigationItems } from './features/numpad/numpad-navigation.js'
import { useNumpadController } from './features/numpad/use-numpad-controller.js'
import { useJournalController } from './features/journal/use-journal-controller.js'
import { journalContext, journalNavigationItems } from './features/journal/journal-navigation.js'
import { settingsContext, settingsNavigationItems } from './features/settings/settings-navigation.js'

const ActivitiesPage = lazy(() => import('./features/activities/activities-page.js').then(module => ({ default: module.ActivitiesPage })))
const CommanderPage = lazy(() => import('./features/commander/commander-page.js').then(module => ({ default: module.CommanderPage })))
const CommsPage = lazy(() => import('./features/comms/comms-page.js').then(module => ({ default: module.CommsPage })))
const ControlsPage = lazy(() => import('./features/controls/controls-page.js').then(module => ({ default: module.ControlsPage })))
const CopilotFeature = lazy(() => import('./features/copilot/copilot-feature.js').then(module => ({ default: module.CopilotFeature })))
const CreditsPage = lazy(() => import('./features/journal/credits-page.js').then(module => ({ default: module.CreditsPage })))
const DashboardPage = lazy(() => import('./features/dashboard/dashboard-page.js').then(module => ({ default: module.DashboardPage })))
const EngineeringPage = lazy(() => import('./features/engineering/engineering-page.js').then(module => ({ default: module.EngineeringPage })))
const FleetPage = lazy(() => import('./features/fleet/fleet-page.js').then(module => ({ default: module.FleetPage })))
const GalaxyPage = lazy(() => import('./features/galaxy/galaxy-page.js').then(module => ({ default: module.GalaxyPage })))
const JournalPage = lazy(() => import('./features/journal/journal-page.js').then(module => ({ default: module.JournalPage })))
const MacrosPage = lazy(() => import('./features/macros/macros-page.js').then(module => ({ default: module.MacrosPage })))
const NumpadPage = lazy(() => import('./features/numpad/numpad-page.js').then(module => ({ default: module.NumpadPage })))
const SettingsPage = lazy(() => import('./features/settings/settings-page.js').then(module => ({ default: module.SettingsPage })))

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
  const activeDesktop = workspaceForRoute(route)
  const mountedWorkspaces = useRef(new Set([activeDesktop]))
  mountedWorkspaces.current.add(activeDesktop)
  const informationRoute = isInformationRoute(route) ? route : router.getRememberedInformationRoute()
  const commanderRoute = informationRoute.section === 'commander' ? informationRoute : undefined
  const fleetRoute = informationRoute.section === 'fleet' ? informationRoute : undefined
  const galaxyRoute = informationRoute.section === 'galaxy' ? informationRoute : undefined
  const activitiesRoute = informationRoute.section === 'activities' ? informationRoute : undefined
  const commsRoute = informationRoute.section === 'comms' ? informationRoute : undefined
  const engineeringRoute = informationRoute.section === 'engineering' ? informationRoute : undefined
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
      activeDesktop={activeDesktop}
      informationRoute={informationRoute}
      {...informationContext}
      onNavigateRoute={router.push}
      onNavigateWorkspace={(workspace) => router.push(router.routeForWorkspace(workspace))}
      controls={mountedWorkspaces.current.has('controls')
        ? <FeatureBoundary><ControlsFeature application={application} category={controlsRoute?.category ?? 'ship'} editing={controlsEditing} onEditingChange={setControlsEditing} /></FeatureBoundary>
        : null}
      controlsContextItems={controlsRailItems}
      controlsCurrentContext={controlsContext(controlsRoute?.category ?? 'ship')}
      onControlsContextAction={(item) => { if (item.id === 'edit-layout') setControlsEditing(current => !current) }}
      copilot={mountedWorkspaces.current.has('copilot')
        ? <FeatureBoundary><StableCopilotFeature application={application} view={route.kind === 'copilot' ? route.view : 'chat'} /></FeatureBoundary>
        : null}
      copilotContextItems={copilotNavigationItems}
      copilotCurrentContext={copilotContext(route)}
      information={mountedWorkspaces.current.has('info')
        ? <FeatureBoundary>{isDashboardRoute(informationRoute)
            ? <DashboardFeature application={application} />
            : commanderRoute
              ? <CommanderFeature application={application} view={commanderRoute.view} />
              : fleetRoute
                ? <FleetFeature key={router.href(fleetRoute)} application={application} route={fleetRoute} />
                : galaxyRoute
                  ? <GalaxyFeature key={router.href(galaxyRoute)} application={application} route={galaxyRoute} />
                  : activitiesRoute
                    ? <ActivitiesFeature key={router.href(activitiesRoute)} application={application} route={activitiesRoute} />
                    : commsRoute
                      ? <CommsFeature key={router.href(commsRoute)} application={application} route={commsRoute} />
                      : engineeringRoute
                        ? <EngineeringFeature key={router.href(engineeringRoute)} application={application} route={engineeringRoute} />
                        : null}</FeatureBoundary>
        : null}
      journal={mountedWorkspaces.current.has('journal')
        ? <FeatureBoundary>{logRoute?.kind === 'developer'
            ? <PlaceholderPage context="Log · Developer" title="Developer tools" description="Runtime inspection and diagnostics" />
            : logRoute?.view === 'credits'
              ? <CreditsPage />
              : <JournalFeature application={application} />}</FeatureBoundary>
        : null}
      journalContextItems={journalNavigationItems}
      journalCurrentContext={journalContext(route)}
      macros={mountedWorkspaces.current.has('macros') ? <FeatureBoundary><MacrosFeature /></FeatureBoundary> : null}
      settings={mountedWorkspaces.current.has('settings')
        ? <FeatureBoundary><StableSettingsPage
            api={application.api}
            devicePreferences={application.devicePreferences}
          /></FeatureBoundary>
        : null}
      settingsContextItems={settingsNavigationItems}
      settingsCurrentContext={settingsContext()}
      telemetry={mountedWorkspaces.current.has('telemetry')
        ? <FeatureBoundary><NumpadFeature application={application} view={numpadRoute?.view ?? 'navigator'} /></FeatureBoundary>
        : null}
      telemetryContextItems={numpadNavigationItems}
      telemetryCurrentContext={numpadContext(route)}
    />
  )
}

function FeatureBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>
}

const StableCopilotFeature = memo(CopilotFeature)
const StableSettingsPage = memo(SettingsPage)

const MacrosFeature = memo(function MacrosFeature() {
  return <MacrosPage runtime={useMacroRuntime()} />
})

const NumpadFeature = memo(function NumpadFeature({ application, view }: { application: PhoenixApplicationServices, view: 'navigator' | 'shortcuts' }) {
  return <NumpadPage api={application.api} controller={useNumpadController(application.api, application.events)} view={view} />
})

const JournalFeature = memo(function JournalFeature({ application }: { application: PhoenixApplicationServices }) {
  return <JournalPage controller={useJournalController(application.api, application.events)} />
})

const ControlsFeature = memo(function ControlsFeature({ application, category, editing, onEditingChange }: {
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
})

const EngineeringFeature = memo(function EngineeringFeature({ application, route }: {
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
})

const CommsFeature = memo(function CommsFeature({ application, route }: {
  application: PhoenixApplicationServices
  route: Extract<ReturnType<PhoenixRouter['getSnapshot']>, { kind: 'information', section: 'comms' }>
}) {
  const controller = useCommsController(application.api, application.events, route.view)
  return <CommsPage
    controller={controller}
    onExecuteAction={actionId => application.api.executeAction(actionId, 'tap')}
    view={route.view}
  />
})

const ActivitiesFeature = memo(function ActivitiesFeature({ application, route }: {
  application: PhoenixApplicationServices
  route: Extract<ReturnType<PhoenixRouter['getSnapshot']>, { kind: 'information', section: 'activities' }>
}) {
  const controller = useActivitiesController(application.api, application.events, route.view, route.fixture)
  return <ActivitiesPage controller={controller} view={route.view} />
})

const GalaxyFeature = memo(function GalaxyFeature({ application, route }: {
  application: PhoenixApplicationServices
  route: Extract<ReturnType<PhoenixRouter['getSnapshot']>, { kind: 'information', section: 'galaxy' }>
}) {
  const runtime = useRuntimeState(application.runtime)
  const systemName = route.view === 'system'
    ? route.systemName ?? (runtime.status === 'ready' ? runtime.state.system.name ?? undefined : undefined)
    : undefined
  const controller = useGalaxyController(application.api, application.events, route.view, systemName)
  return <GalaxyPage api={application.api} controller={controller} onNavigate={application.router.push} route={route} runtime={runtime} />
})

const FleetFeature = memo(function FleetFeature({ application, route }: {
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
})

const CommanderFeature = memo(function CommanderFeature({ application, view }: {
  application: PhoenixApplicationServices
  view: 'overview' | 'inventory' | 'progress'
}) {
  const runtime = useRuntimeState(application.runtime)
  const model = useMemo(
    () => runtime.status === 'ready' ? createCommanderViewModel(runtime.state) : undefined,
    [runtime]
  )
  return <CommanderPage model={model} runtime={runtime} view={view} />
})

const DashboardFeature = memo(function DashboardFeature({ application }: { application: PhoenixApplicationServices }) {
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
})

function isDashboardRoute(route: ReturnType<PhoenixRouter['getSnapshot']>): boolean {
  return route.kind === 'information' && route.section === 'home' && route.view === 'overview'
}
