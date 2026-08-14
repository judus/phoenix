import { useEffect, useState } from 'react'
import {
  CommandCatalogueRevisionSchema,
  RuntimeStateSchema,
  type CatalogueDiagnostics,
  type ControlGridLayout,
  type GameActionCatalogResponse,
  type GameActionOperation,
  type GameActionResult,
  type EliteJournalSourceDiagnostics,
  type EliteStatusSourceDiagnostics,
  type HealthResponse,
  type PhoenixModules,
  type RuntimeState
} from '@phoenix/contracts'
import { parseDisplayCommand, PhoenixApiClient } from './api/phoenix-api-client.js'
import { subscribePhoenixEvent } from './api/phoenix-event-stream.js'
import { allowsRemoteDisplayCommands } from './features/display/display-command-preferences.js'
import { armNumpadRoute } from './features/numpad/numpad-route-session.js'
import { DeveloperPage, type DeveloperView } from './pages/developer-page.js'
import { ControlsPage, type ControlCategory } from './pages/controls-page.js'
import { CopilotPage, type CopilotView } from './pages/copilot-page.js'
import { LogPage } from './pages/log-page.js'
import { NavigationPage, type NavigationView } from './pages/navigation-page.js'
import { EngineeringPage, type EngineeringView } from './pages/engineering-page.js'
import { DashboardPage } from './pages/dashboard-page.js'
import { ShipPage, type FleetView } from './pages/ship-page.js'
import { ExplorationPage, type ExplorationView } from './pages/exploration-page.js'
import { CommanderPage, type CommanderView } from './pages/commander-page.js'
import {
  InformationSectionPage,
  type CommsView,
  type OperationsView
} from './pages/information-section-page.js'
import { PairingPage } from './pages/pairing-page.js'
import { NumpadPage } from './pages/numpad-page.js'
import { SettingsPage, type SettingsView } from './pages/settings-page.js'
import { CopilotVoiceProvider } from './features/copilot/copilot-voice-provider.js'
import { DesktopWorkspace, type DesktopMode } from './components/layout/desktop-workspace.js'
import { PhoenixTopBar } from './components/layout/phoenix-shell.js'

const api = new PhoenixApiClient()

export function App () {
  const [paired, setPaired] = useState<boolean>()
  const [pairingError, setPairingError] = useState<string>()

  useEffect(() => {
    void api.getPairingStatus()
      .then(status => setPaired(status.authenticated))
      .catch(cause => setPairingError(cause instanceof Error ? cause.message : 'PHOENIX pairing unavailable.'))
  }, [])

  if (paired !== true) {
    return (
      <PairingPage
        checking={paired === undefined && pairingError === undefined}
        error={pairingError}
        onPair={async code => {
          const status = await api.claimPairing(code)
          setPairingError(undefined)
          setPaired(status.authenticated)
        }}
      />
    )
  }

  return <CopilotVoiceProvider><AuthenticatedApplication /></CopilotVoiceProvider>
}

function AuthenticatedApplication () {
  const [health, setHealth] = useState<HealthResponse>()
  const [actionCatalog, setActionCatalog] = useState<GameActionCatalogResponse>()
  const [catalogueDiagnostics, setCatalogueDiagnostics] = useState<CatalogueDiagnostics>()
  const [controlLayout, setControlLayout] = useState<ControlGridLayout>()
  const [commandCatalogueRevision, setCommandCatalogueRevision] = useState(0)
  const [actionPending, setActionPending] = useState<string>()
  const [lastActionResult, setLastActionResult] = useState<GameActionResult>()
  const [eliteStatusDiagnostics, setEliteStatusDiagnostics] = useState<EliteStatusSourceDiagnostics>()
  const [eliteJournalDiagnostics, setEliteJournalDiagnostics] = useState<EliteJournalSourceDiagnostics>()
  const [runtimeState, setRuntimeState] = useState<RuntimeState>()
  const [error, setError] = useState<string>()
  const [route, setRoute] = useState(readRoute)
  const [informationHash, setInformationHash] = useState(readInformationHash)
  const [informationRoute, setInformationRoute] = useState<AppRoute>(() => readRoute(readInformationHash()))
  const [controlCategory, setControlCategory] = useState<ControlCategory>(() => (
    route.section === 'controls' ? route.category : 'ship'
  ))
  const [moduleSettings, setModuleSettings] = useState<PhoenixModules>()

  useEffect(() => {
    api.getHealth()
      .then(setHealth)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Backend unavailable.'))

    api.getRuntimeState()
      .then(setRuntimeState)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Runtime state unavailable.'))

    api.getActions()
      .then(setActionCatalog)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Action catalogue unavailable.'))

    api.getCatalogueDiagnostics()
      .then(setCatalogueDiagnostics)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Game catalogue diagnostics unavailable.'))

    api.getControlLayout()
      .then(setControlLayout)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Control layout unavailable.'))

    api.getModuleSettings()
      .then(setModuleSettings)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Module settings unavailable.'))

    api.getEliteStatusDiagnostics()
      .then(setEliteStatusDiagnostics)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Elite status diagnostics unavailable.'))

    api.getEliteJournalDiagnostics()
      .then(setEliteJournalDiagnostics)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Elite journal diagnostics unavailable.'))

    const unsubscribeRuntime = subscribePhoenixEvent(api, 'runtime-state', event => {
      try {
        setRuntimeState(RuntimeStateSchema.parse(JSON.parse(event.data)))
        void api.getEliteStatusDiagnostics()
          .then(setEliteStatusDiagnostics)
          .catch(cause => setError(
            cause instanceof Error ? cause.message : 'Elite status diagnostics unavailable.'
          ))
        void api.getEliteJournalDiagnostics()
          .then(setEliteJournalDiagnostics)
          .catch(cause => setError(
            cause instanceof Error ? cause.message : 'Elite journal diagnostics unavailable.'
          ))
        void api.getCatalogueDiagnostics()
          .then(setCatalogueDiagnostics)
          .catch(cause => setError(
            cause instanceof Error ? cause.message : 'Game catalogue diagnostics unavailable.'
          ))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Invalid runtime state received.')
      }
    })

    const unsubscribeDisplay = subscribePhoenixEvent(api, 'display-command', event => {
      try {
        if (!allowsRemoteDisplayCommands()) return
        const command = parseDisplayCommand(JSON.parse(event.data))
        const parameters = new URLSearchParams({ name: command.systemName })
        if (command.selectedName) parameters.set('selected', command.selectedName)
        window.location.hash = `/galaxy/system?${parameters.toString()}`
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Invalid display command received.')
      }
    })

    const unsubscribeCommandCatalogue = subscribePhoenixEvent(api, 'command-catalogue', event => {
      try {
        const revision = CommandCatalogueRevisionSchema.parse(JSON.parse(event.data))
        setCommandCatalogueRevision(current => Math.max(current, revision.revision))
        void api.getControlLayout()
          .then(setControlLayout)
          .catch(cause => setError(cause instanceof Error ? cause.message : 'Control layout unavailable.'))
        void api.getModuleSettings()
          .then(setModuleSettings)
          .catch(cause => setError(cause instanceof Error ? cause.message : 'Module settings unavailable.'))
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Invalid command catalogue revision received.')
      }
    })

    const handleRouteChange = (): void => {
      const nextRoute = readRoute()
      setRoute(nextRoute)
      if (nextRoute.section === 'controls') setControlCategory(nextRoute.category)
      if (isInformationRoute(nextRoute)) {
        setInformationRoute(nextRoute)
        if (nextRoute.section !== 'numpad') {
          const hash = normalizedHash(window.location.hash)
          setInformationHash(hash)
          window.sessionStorage.setItem(INFORMATION_ROUTE_STORAGE_KEY, hash)
        }
      }
    }
    window.addEventListener('hashchange', handleRouteChange)

    return () => {
      unsubscribeRuntime()
      unsubscribeDisplay()
      unsubscribeCommandCatalogue()
      window.removeEventListener('hashchange', handleRouteChange)
    }
  }, [])

  useEffect(() => {
    if (moduleSettings?.numpadCommands.enabled !== true) return
    const activateNumpad = (event: KeyboardEvent): void => {
      if (event.code !== 'Numpad0' || isEditableTarget(event.target) || readRoute().section === 'numpad') return
      event.preventDefault()
      armNumpadRoute(window.location.hash)
      window.location.hash = '#/numpad'
    }
    window.addEventListener('keydown', activateNumpad)
    return () => window.removeEventListener('keydown', activateNumpad)
  }, [moduleSettings?.numpadCommands.enabled])

  const activeMode = desktopMode(route)
  const navigateDesktop = (mode: DesktopMode): void => {
    const destination = mode === 'controls'
      ? `#/controls/${controlCategory}`
      : mode === 'copilot'
        ? '#/copilot/chat'
        : informationHash
    if (window.location.hash !== destination) window.location.hash = destination
  }

  const information = (() => {
    if (informationRoute.section === 'developer') {
      return (
        <DeveloperPage
          actionCatalog={actionCatalog}
          actionPending={actionPending}
          catalogueDiagnostics={catalogueDiagnostics}
          error={error}
          eliteJournalDiagnostics={eliteJournalDiagnostics}
          eliteStatusDiagnostics={eliteStatusDiagnostics}
          health={health}
          lastActionResult={lastActionResult}
          runtimeState={runtimeState}
          view={informationRoute.view}
          onExecuteAction={async actionId => {
            setActionPending(actionId)
            try {
              setLastActionResult(await api.executeDeveloperAction(actionId))
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Action execution failed.')
            } finally {
              setActionPending(undefined)
            }
          }}
        />
      )
    }
    if (informationRoute.section === 'records' && informationRoute.view === 'journal') {
      return <LogPage api={api} error={error} health={health} />
    }
    if (informationRoute.section === 'numpad') {
      return <NumpadPage api={api} error={error} health={health} view={informationRoute.view} />
    }
    if (informationRoute.section === 'settings') {
      return <SettingsPage health={health} view={informationRoute.view} />
    }
    if (informationRoute.section === 'galaxy') {
      return (
        <NavigationPage
          api={api}
          error={error}
          health={health}
          runtimeState={runtimeState}
          selectedName={informationRoute.selectedName}
          systemName={informationRoute.systemName}
          view={informationRoute.view}
        />
      )
    }
    if (informationRoute.section === 'engineering') {
      return (
        <EngineeringPage
          api={api}
          error={error}
          health={health}
          runtimeState={runtimeState}
          view={informationRoute.view}
        />
      )
    }
    if (informationRoute.section === 'fleet') {
      return (
        <ShipPage
          api={api}
          error={error}
          health={health}
          runtimeState={runtimeState}
          view={informationRoute.view}
        />
      )
    }
    if (informationRoute.section === 'records' && informationRoute.view !== 'journal') {
      return (
        <ExplorationPage
          api={api}
          bodyName={informationRoute.bodyName}
          error={error}
          health={health}
          runtimeState={runtimeState}
          systemName={informationRoute.systemName}
          view={informationRoute.view}
        />
      )
    }
    if (informationRoute.section === 'commander') {
      return <CommanderPage error={error} health={health} runtimeState={runtimeState} view={informationRoute.view} />
    }
    if (informationRoute.section === 'operations' || informationRoute.section === 'comms') {
      return (
        <InformationSectionPage
          actionCatalog={actionCatalog}
          api={api}
          error={error}
          health={health}
          route={informationRoute}
          onExecuteAction={(actionId, operation) => api.executeAction(actionId, operation)}
        />
      )
    }
    return (
      <DashboardPage
        actionCatalog={actionCatalog}
        api={api}
        health={health}
        error={error}
        runtimeState={runtimeState}
        onExecuteAction={(actionId, operation) => api.executeAction(actionId, operation)}
      />
    )
  })()

  return (
    <DesktopWorkspace
      activeMode={activeMode}
      controls={(
        <ControlsPage
          api={api}
          actionCatalog={actionCatalog}
          commandCatalogueRevision={commandCatalogueRevision}
          category={controlCategory}
          controlLayout={controlLayout}
          error={error}
          health={health}
          runtimeState={runtimeState}
          onExecuteCommand={(target, operation) => (
            api.executeCommand(target, operation)
          )}
          onSaveLayout={async layout => {
            const saved = await api.saveControlLayout(layout)
            setControlLayout(saved)
            return saved
          }}
        />
      )}
      copilot={<CopilotPage
        api={api}
        error={error}
        health={health}
        view={route.section === 'copilot' ? route.view : 'chat'}
      />}
      information={information}
      onNavigate={navigateDesktop}
      topBar={(
        <PhoenixTopBar
          developerSection={informationRoute.section === 'developer'}
          numpadSection={informationRoute.section === 'numpad'}
          recordsSection={informationRoute.section === 'records'}
          settingsSection={informationRoute.section === 'settings'}
        />
      )}
    />
  )
}

export type AppRoute =
  | { section: 'main' }
  | { section: 'copilot', view: CopilotView }
  | { section: 'numpad', view: 'navigator' | 'shortcuts' }
  | { section: 'settings', view: SettingsView }
  | { section: 'commander', view: CommanderView }
  | { section: 'operations', view: OperationsView }
  | { section: 'comms', view: CommsView }
  | { section: 'records', view: 'journal' | ExplorationView, systemName?: string, bodyName?: string }
  | { section: 'galaxy', view: NavigationView, systemName?: string, selectedName?: string }
  | { section: 'engineering', view: EngineeringView }
  | { section: 'fleet', view: FleetView }
  | { section: 'controls', category: ControlCategory }
  | { section: 'developer', view: DeveloperView }

const CONTROL_CATEGORIES: ControlCategory[] = [
  'ship', 'combat', 'navigation', 'vessel', 'srv', 'on_foot', 'radio', 'emote', 'misc', 'macros'
]
const INFORMATION_ROUTE_STORAGE_KEY = 'phoenix.desktop.information-route'

export function readRoute (routeHash?: string): AppRoute {
  const hash = routeHash ?? (typeof window === 'undefined' ? '#/' : window.location.hash)
  const copilotMatch = hash.match(/^#\/?copilot(?:\/(chat|profiles))?$/u)
  if (copilotMatch) return { section: 'copilot', view: (copilotMatch[1] ?? 'chat') as CopilotView }
  const numpadMatch = hash.match(/^#\/?numpad(?:\/(shortcuts))?$/u)
  if (numpadMatch) return { section: 'numpad', view: numpadMatch[1] === 'shortcuts' ? 'shortcuts' : 'navigator' }
  const settingsMatch = hash.match(/^#\/?settings(?:\/(system|audio|modules|pairing))?$/u)
  if (settingsMatch) return { section: 'settings', view: (settingsMatch[1] ?? 'system') as SettingsView }
  if (/^#\/?(?:log|records\/journal)$/u.test(hash)) return { section: 'records', view: 'journal' }
  const commanderMatch = hash.match(/^#\/?commander\/(overview|inventory|progress)$/u)
  if (commanderMatch) return { section: 'commander', view: commanderMatch[1] as CommanderView }
  if (/^#\/?ship\/inventory$/u.test(hash)) return { section: 'commander', view: 'inventory' }
  const operationsMatch = hash.match(/^#\/?operations(?:\/(overview|missions|objectives|community-goals|powerplay|colonisation))?$/u)
  if (operationsMatch) return { section: 'operations', view: (operationsMatch[1] ?? 'overview') as OperationsView }
  const commsMatch = hash.match(/^#\/?comms(?:\/(overview|inbox|traffic|contacts|galnet|radio))?$/u)
  if (commsMatch) return { section: 'comms', view: (commsMatch[1] ?? 'overview') as CommsView }
  const navigationMatch = hash.match(/^#\/?(?:navigation|galaxy)\/(database|system|route)(?:\?(.*))?$/u)
  if (navigationMatch) {
    const parameters = new URLSearchParams(navigationMatch[2] ?? '')
    const systemName = parameters.get('name')?.trim() || undefined
    const selectedName = parameters.get('selected')?.trim() || undefined
    return {
      section: 'galaxy',
      view: navigationMatch[1] as NavigationView,
      ...(systemName ? { systemName } : {}),
      ...(selectedName ? { selectedName } : {})
    }
  }
  const engineeringMaterialsMatch = hash.match(/^#\/?engineering\/materials\/(raw|manufactured|encoded|xeno)$/u)
  if (engineeringMaterialsMatch) {
    return {
      section: 'engineering',
      view: { type: 'materials', category: engineeringMaterialsMatch[1] as 'raw' | 'manufactured' | 'encoded' | 'xeno' }
    }
  }
  if (/^#\/?engineering\/engineers$/u.test(hash)) {
    return { section: 'engineering', view: { type: 'engineers' } }
  }
  const shipMatch = hash.match(/^#\/?ship\/(status|modules|cargo)$/u)
  if (shipMatch) {
    return { section: 'fleet', view: shipMatch[1] as FleetView }
  }
  const currentShipMatch = hash.match(/^#\/?fleet\/ships\/current\/(overview|loadout|cargo)$/u)
  if (currentShipMatch) {
    const view = currentShipMatch[1] === 'overview' ? 'status' : currentShipMatch[1] === 'loadout' ? 'modules' : 'cargo'
    return { section: 'fleet', view }
  }
  const fleetSectionMatch = hash.match(/^#\/?fleet\/(overview|carriers|stored-modules|catalogue)$/u)
  if (fleetSectionMatch) return { section: 'fleet', view: fleetSectionMatch[1] as FleetView }
  const fleetMatch = hash.match(/^#\/?fleet\/(current|loadout|cargo)$/u)
  if (fleetMatch) {
    const view = fleetMatch[1] === 'current' ? 'status' : fleetMatch[1] === 'loadout' ? 'modules' : 'cargo'
    return { section: 'fleet', view }
  }
  const explorationMatch = hash.match(/^#\/?(?:exploration|records\/exploration)\/(ledger|body|biology|geology)(?:\?(.*))?$/u)
  if (explorationMatch) {
    const parameters = new URLSearchParams(explorationMatch[2] ?? '')
    const systemName = parameters.get('system')?.trim() || undefined
    const bodyName = parameters.get('body')?.trim() || undefined
    return {
      section: 'records',
      view: explorationMatch[1] as ExplorationView,
      ...(systemName ? { systemName } : {}),
      ...(bodyName ? { bodyName } : {})
    }
  }
  const engineeringBlueprintsMatch = hash.match(/^#\/?engineering\/blueprints(?:\?(.*))?$/u)
  if (engineeringBlueprintsMatch) {
    const symbol = new URLSearchParams(engineeringBlueprintsMatch[1] ?? '').get('symbol')?.trim() || undefined
    return {
      section: 'engineering',
      view: { type: 'blueprints', ...(symbol ? { symbol } : {}) }
    }
  }
  const controlsMatch = hash.match(/^#\/?controls(?:\/([a-z_]+))?$/)
  if (controlsMatch) {
    const category = CONTROL_CATEGORIES.find(candidate => candidate === controlsMatch[1]) ?? 'ship'
    return { section: 'controls', category }
  }
  const match = hash.match(/^#\/developer\/(overview|runtime|elite|health|tests|controls)$/)
  if (!match) return { section: 'main' }
  return { section: 'developer', view: match[1] as DeveloperView }
}

function desktopMode (route: AppRoute): DesktopMode {
  if (route.section === 'controls') return 'controls'
  if (route.section === 'copilot') return 'copilot'
  return 'information'
}

function isInformationRoute (route: AppRoute): boolean {
  return route.section !== 'controls' && route.section !== 'copilot'
}

function normalizedHash (hash: string): string {
  return hash.trim() === '' || hash === '#' ? '#/' : hash
}

function readInformationHash (): string {
  if (typeof window === 'undefined') return '#/'
  const current = normalizedHash(window.location.hash)
  if (isInformationRoute(readRoute(current))) return current
  const stored = window.sessionStorage.getItem(INFORMATION_ROUTE_STORAGE_KEY)
  if (stored && isInformationRoute(readRoute(stored))) return stored
  return '#/'
}

function isEditableTarget (target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (
    target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
  )
}
