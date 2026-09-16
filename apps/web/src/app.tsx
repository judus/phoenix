import { lazy, memo, Suspense, useMemo, useState, type ReactNode } from 'react'
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
import { DevicePresentation } from './components/device-presentation.js'
import { PhoenixProviders } from './bootstrap/providers.js'
import { useCopilotVoice } from './features/copilot/copilot-voice-provider.js'
import { copilotContext, copilotNavigationItems } from './features/copilot/copilot-navigation.js'
import { createDashboardViewModel } from './features/dashboard/dashboard-view-model.js'
import { useDashboardController } from './features/dashboard/use-dashboard-controller.js'
import { createCommanderViewModel } from './features/commander/commander-view-model.js'
import type { CommanderView } from './features/commander/commander-page.js'
import { commanderContextForRoute, commanderNavigationItems } from './features/commander/commander-navigation.js'
import { equipmentContextForRoute, equipmentNavigationItems } from './features/equipment/equipment-navigation.js'
import { usePersonalEquipmentController } from './features/equipment/use-personal-equipment-controller.js'
import { usePersonalMaterialsController } from './features/equipment/use-personal-materials-controller.js'
import { usePersonalEquipmentUpgradesController } from './features/equipment/use-personal-equipment-upgrades-controller.js'
import { usePersonalEquipmentSpecialistsController } from './features/equipment/use-personal-equipment-specialists-controller.js'
import { usePersonalEquipmentPlannerController } from './features/equipment/use-personal-equipment-planner-controller.js'
import { fleetContextForRoute, fleetNavigationItems } from './features/fleet/fleet-navigation.js'
import { useFleetController } from './features/fleet/use-fleet-controller.js'
import { galaxyContextForRoute, galaxyNavigationItems } from './features/galaxy/galaxy-navigation.js'
import { useGalaxyController } from './features/galaxy/use-galaxy-controller.js'
import { activitiesContextForRoute, activitiesNavigationItems } from './features/activities/activities-navigation.js'
import { useActivitiesController } from './features/activities/use-activities-controller.js'
import { commsContextForRoute, commsNavigationItems } from './features/comms/comms-navigation.js'
import { useCommsController } from './features/comms/use-comms-controller.js'
import { engineeringContextForRoute, engineeringNavigationItems } from './features/engineering/engineering-navigation.js'
import { useEngineeringController } from './features/engineering/use-engineering-controller.js'
import { controlsContext, controlsNavigationItems } from './features/controls/controls-navigation.js'
import { useControlsController } from './features/controls/use-controls-controller.js'
import { useMacroRuntime } from './features/macros/macro-runtime-provider.js'
import { useNumpadController } from './features/numpad/use-numpad-controller.js'
import { useJournalController } from './features/journal/use-journal-controller.js'
import { journalContext, journalNavigationItems } from './features/journal/journal-navigation.js'
import { settingsContext, settingsNavigationItems } from './features/settings/settings-navigation.js'

const ActivitiesPage = lazy(() => import('./features/activities/activities-page.js').then(module => ({ default: module.ActivitiesPage })))
const CommanderLoadoutsPage = lazy(() => import('./features/equipment/commander-loadouts-page.js').then(module => ({ default: module.CommanderLoadoutsPage })))
const CommanderPage = lazy(() => import('./features/commander/commander-page.js').then(module => ({ default: module.CommanderPage })))
const CommsPage = lazy(() => import('./features/comms/comms-page.js').then(module => ({ default: module.CommsPage })))
const ControlsPage = lazy(() => import('./features/controls/controls-page.js').then(module => ({ default: module.ControlsPage })))
const CopilotFeature = lazy(() => import('./features/copilot/copilot-feature.js').then(module => ({ default: module.CopilotFeature })))
const CreditsPage = lazy(() => import('./features/journal/credits-page.js').then(module => ({ default: module.CreditsPage })))
const DashboardPage = lazy(() => import('./features/dashboard/dashboard-page.js').then(module => ({ default: module.DashboardPage })))
const EngineeringPage = lazy(() => import('./features/engineering/engineering-page.js').then(module => ({ default: module.EngineeringPage })))
const EquipmentPage = lazy(() => import('./features/equipment/equipment-page.js').then(module => ({ default: module.EquipmentPage })))
const EquipmentMaterialsPage = lazy(() => import('./features/equipment/equipment-materials-page.js').then(module => ({ default: module.EquipmentMaterialsPage })))
const EquipmentUpgradesPage = lazy(() => import('./features/equipment/equipment-upgrades-page.js').then(module => ({ default: module.EquipmentUpgradesPage })))
const EquipmentSpecialistsPage = lazy(() => import('./features/equipment/equipment-specialists-page.js').then(module => ({ default: module.EquipmentSpecialistsPage })))
const EquipmentPlannerPage = lazy(() => import('./features/equipment/equipment-planner-page.js').then(module => ({ default: module.EquipmentPlannerPage })))
const FleetPage = lazy(() => import('./features/fleet/fleet-page.js').then(module => ({ default: module.FleetPage })))
const GalaxyPage = lazy(() => import('./features/galaxy/galaxy-page.js').then(module => ({ default: module.GalaxyPage })))
const HelpPage = lazy(() => import('./features/settings/help-page.js').then(module => ({ default: module.HelpPage })))
const CopilotSettingsPage = lazy(() => import('./features/settings/copilot-settings-page.js').then(module => ({ default: module.CopilotSettingsPage })))
const PairingSettingsPage = lazy(() => import('./features/settings/pairing-settings-page.js').then(module => ({ default: module.PairingSettingsPage })))
const JournalPage = lazy(() => import('./features/journal/journal-page.js').then(module => ({ default: module.JournalPage })))
const MacrosPage = lazy(() => import('./features/macros/macros-page.js').then(module => ({ default: module.MacrosPage })))
const NumpadPage = lazy(() => import('./features/numpad/numpad-page.js').then(module => ({ default: module.NumpadPage })))
const SettingsPage = lazy(() => import('./features/settings/settings-page.js').then(module => ({ default: module.SettingsPage })))

export function App({ application }: { application: PhoenixApplicationServices }) {
  return (
    <DevicePresentation preferences={application.devicePreferences}>
      <PairingGate api={application.api}>
        <PhoenixProviders application={application}>
          <PhoenixApplication application={application} />
        </PhoenixProviders>
      </PairingGate>
    </DevicePresentation>
  )
}

function PhoenixApplication({ application }: { application: PhoenixApplicationServices }) {
  const { router } = application
  const route = usePhoenixRoute(router)
  const activeDesktop = workspaceForRoute(route)
  const informationRoute = isInformationRoute(route) ? route : router.getRememberedInformationRoute()
  const commanderRoute = informationRoute.section === 'commander' ? informationRoute : undefined
  const fleetRoute = informationRoute.section === 'fleet' ? informationRoute : undefined
  const galaxyRoute = informationRoute.section === 'galaxy' ? informationRoute : undefined
  const activitiesRoute = informationRoute.section === 'activities' ? informationRoute : undefined
  const commsRoute = informationRoute.section === 'comms' ? informationRoute : undefined
  const engineeringRoute = informationRoute.section === 'engineering' ? informationRoute : undefined
  const equipmentRoute = informationRoute.section === 'equipment' ? informationRoute : undefined
  const controlsRoute = route.kind === 'controls' ? route : undefined
  const logRoute = route.kind === 'journal' || route.kind === 'developer' ? route : undefined
  const [controlsEditing, setControlsEditing] = useState(false)
  const controlsRailItems = useMemo<ApplicationNavigationItem[]>(() => [
    ...controlsNavigationItems,
    {
      id: 'edit-layout',
      kind: 'action',
      label: controlsEditing ? 'Cancel layout editing' : 'Edit layout',
      placement: 'end',
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
              informationContextItems: activitiesNavigationItems,
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
              : equipmentRoute
                ? {
                    informationContextItems: equipmentNavigationItems,
                    informationContextLabel: 'Equipment views',
                    informationCurrentContext: equipmentContextForRoute(equipmentRoute)
                  }
      : undefined

  return (
    <PhoenixApplicationShell
      activeDesktop={activeDesktop}
      informationRoute={informationRoute}
      {...informationContext}
      onNavigateRoute={router.push}
      onNavigateWorkspace={(workspace) => router.push(router.routeForWorkspace(workspace))}
      controls={activeDesktop === 'controls'
        ? <FeatureBoundary><ControlsFeature application={application} category={controlsRoute?.category ?? 'ship'} editing={controlsEditing} onEditingChange={setControlsEditing} /></FeatureBoundary>
        : null}
      controlsContextItems={controlsRailItems}
      controlsCurrentContext={controlsContext(controlsRoute?.category ?? 'ship')}
      onControlsContextAction={(item) => { if (item.id === 'edit-layout') setControlsEditing(current => !current) }}
      copilot={activeDesktop === 'copilot'
        ? <FeatureBoundary><StableCopilotFeature application={application} view={route.kind === 'copilot' ? route.view : 'chat'} /></FeatureBoundary>
        : null}
      copilotContextItems={copilotNavigationItems}
      copilotCurrentContext={copilotContext(route)}
      information={activeDesktop === 'info'
        ? <FeatureBoundary>{commanderRoute
            ? commanderRoute.view === 'dashboard'
              ? <DashboardFeature application={application} />
              : commanderRoute.view === 'loadouts'
                ? <PersonalEquipmentFeature application={application} view="loadouts" />
                : <CommanderFeature application={application} view={commanderRoute.view} />
              : fleetRoute
                ? <FleetFeature key={router.href(fleetRoute)} application={application} route={fleetRoute} />
                : galaxyRoute
                  ? <GalaxyFeature key={galaxyRoute.view} application={application} route={galaxyRoute} />
                  : activitiesRoute
                    ? <ActivitiesFeature key={router.href(activitiesRoute)} application={application} route={activitiesRoute} />
                    : commsRoute
                      ? <CommsFeature key={router.href(commsRoute)} application={application} route={commsRoute} />
                      : engineeringRoute
                        ? <EngineeringFeature key={router.href(engineeringRoute)} application={application} route={engineeringRoute} />
                        : equipmentRoute
                          ? <PersonalEquipmentFeature
                              application={application}
                              selectedSpecialistId={equipmentRoute.view === 'specialists' ? equipmentRoute.selectedSpecialistId : undefined}
                              selectedUpgradeId={equipmentRoute.view === 'upgrades' ? equipmentRoute.selectedUpgradeId : undefined}
                              view={equipmentRoute.view}
                            />
                        : null}</FeatureBoundary>
        : null}
      journal={activeDesktop === 'journal'
        ? <FeatureBoundary>{logRoute?.kind === 'developer'
            ? <PlaceholderPage context="Log · Developer" title="Developer tools" />
            : logRoute?.view === 'credits'
              ? <CreditsPage />
              : <JournalFeature application={application} />}</FeatureBoundary>
        : null}
      journalContextItems={journalNavigationItems}
      journalCurrentContext={journalContext(route)}
      macros={activeDesktop === 'macros' ? <FeatureBoundary><MacrosFeature /></FeatureBoundary> : null}
      settings={activeDesktop === 'settings'
        ? <FeatureBoundary><SettingsFeature application={application} view={route.kind === 'settings' ? route.view : 'general'} /></FeatureBoundary>
        : null}
      settingsContextItems={settingsNavigationItems}
      settingsCurrentContext={settingsContext(route.kind === 'settings' ? route : undefined)}
      telemetry={activeDesktop === 'telemetry'
        ? <FeatureBoundary><NumpadFeature application={application} /></FeatureBoundary>
        : null}
    />
  )
}

function FeatureBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>
}

const StableCopilotFeature = memo(CopilotFeature)
const SettingsFeature = memo(function SettingsFeature({ application, view }: { application: PhoenixApplicationServices, view: 'general' | 'pairing' | 'copilot' | 'help' }) {
  const voice = useCopilotVoice()
  if (view === 'help') return <HelpPage />
  if (view === 'pairing') return <PairingSettingsPage api={application.api} />
  if (view === 'copilot') return <CopilotSettingsPage
    api={application.api}
    audio={{
      devices: voice.devices,
      inputId: voice.inputId,
      outputId: voice.outputId,
      setInputId: voice.setInputId,
      setOutputId: voice.setOutputId
    }}
  />
  return <SettingsPage
    api={application.api}
    devicePreferences={application.devicePreferences}
  />
})

const MacrosFeature = memo(function MacrosFeature() {
  return <MacrosPage runtime={useMacroRuntime()} />
})

const NumpadFeature = memo(function NumpadFeature({ application }: { application: PhoenixApplicationServices }) {
  return <NumpadPage api={application.api} controller={useNumpadController(application.api, application.events)} devicePreferences={application.devicePreferences} routeSession={application.numpadRouteSession} />
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
    onExecuteAction={(actionId, operation, leaseId) => application.api.executeAction(actionId, operation, { leaseId })}
    onSaveConfiguration={configuration => application.api.saveControlDeckConfiguration(configuration)}
  />
})

const EngineeringFeature = memo(function EngineeringFeature({ application, route }: {
  application: PhoenixApplicationServices
  route: Extract<ReturnType<PhoenixRouter['getSnapshot']>, { kind: 'information', section: 'engineering' }>
}) {
  const runtime = useRuntimeState(application.runtime)
  const controller = useEngineeringController(
    application.api,
    route,
    runtime.status === 'ready' ? runtime.state.revision : undefined,
    application.events
  )
  return <EngineeringPage controller={controller} onNavigate={application.router.push} route={route} />
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
  const controller = useActivitiesController(application.api, application.events, route.view)
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
  return <GalaxyPage
    api={application.api}
    controller={controller}
    onNavigate={application.router.push}
    querySessions={application.galaxyQueries}
    route={route}
    runtime={runtime}
  />
})

const FleetFeature = memo(function FleetFeature({ application, route }: {
  application: PhoenixApplicationServices
  route: Extract<ReturnType<PhoenixRouter['getSnapshot']>, { kind: 'information', section: 'fleet' }>
}) {
  const runtime = useRuntimeState(application.runtime)
  const controller = useFleetController(application.api, application.events, route.view)
  return <FleetPage
    controller={controller}
    devicePreferences={application.devicePreferences}
    onExecuteAction={actionId => application.api.executeAction(actionId, 'tap')}
    onNavigate={application.router.push}
    route={route}
    runtime={runtime}
  />
})

const CommanderFeature = memo(function CommanderFeature({ application, view }: {
  application: PhoenixApplicationServices
  view: CommanderView
}) {
  const runtime = useRuntimeState(application.runtime)
  const model = useMemo(
    () => runtime.status === 'ready' ? createCommanderViewModel(runtime.state) : undefined,
    [runtime]
  )
  return <CommanderPage model={model} runtime={runtime} view={view} />
})

const PersonalEquipmentFeature = memo(function PersonalEquipmentFeature({ application, selectedSpecialistId, selectedUpgradeId, view }: {
  application: PhoenixApplicationServices
  selectedSpecialistId?: string
  selectedUpgradeId?: string
  view: 'gear' | 'loadouts' | 'materials' | 'planner' | 'specialists' | 'upgrades'
}) {
  const equipment = usePersonalEquipmentController(application.api, application.events, view === 'gear' || view === 'loadouts')
  const materials = usePersonalMaterialsController(application.api, application.events, view === 'materials')
  const upgrades = usePersonalEquipmentUpgradesController(application.api, view === 'upgrades')
  const specialists = usePersonalEquipmentSpecialistsController(application.api, view === 'specialists')
  const planner = usePersonalEquipmentPlannerController(application.api, view === 'planner')
  if (view === 'materials') return <EquipmentMaterialsPage controller={materials} />
  if (view === 'specialists') return <EquipmentSpecialistsPage controller={specialists} selectedSpecialistId={selectedSpecialistId} />
  if (view === 'upgrades') return <EquipmentUpgradesPage controller={upgrades} selectedUpgradeId={selectedUpgradeId} />
  if (view === 'planner') return <EquipmentPlannerPage controller={planner} />
  return view === 'gear'
    ? <EquipmentPage controller={equipment} />
    : <CommanderLoadoutsPage controller={equipment} />
})

const DashboardFeature = memo(function DashboardFeature({ application }: { application: PhoenixApplicationServices }) {
  const controller = useDashboardController(application.api, application.events)
  const runtime = useRuntimeState(application.runtime)
  const eventConnection = usePhoenixEventConnection(application.events)
  const voice = useCopilotVoice()
  const model = useMemo(() => createDashboardViewModel(
    runtime.status === 'ready' ? runtime.state : undefined,
    controller.route,
    controller.commanderLog,
    controller.localTraffic?.messages ?? []
  ), [controller.commanderLog, controller.localTraffic, controller.route, runtime])

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
        transitioning: voice.transitioning
      }}
    />
  )
})
