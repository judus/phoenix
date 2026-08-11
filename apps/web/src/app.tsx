import { useEffect, useState } from 'react'
import {
  RuntimeStateSchema,
  type CatalogueDiagnostics,
  type ControlGridLayout,
  type GameActionCatalogResponse,
  type GameActionOperation,
  type GameActionResult,
  type EliteJournalSourceDiagnostics,
  type EliteStatusSourceDiagnostics,
  type HealthResponse,
  type RuntimeState
} from '@phoenix/contracts'
import { parseDisplayCommand, PhoenixApiClient } from './api/phoenix-api-client.js'
import { subscribePhoenixEvent } from './api/phoenix-event-stream.js'
import { DeveloperPage, type DeveloperView } from './pages/developer-page.js'
import { ControlsPage, type ControlCategory } from './pages/controls-page.js'
import { CopilotPage } from './pages/copilot-page.js'
import { LogPage } from './pages/log-page.js'
import { NavigationPage, type NavigationView } from './pages/navigation-page.js'
import { EngineeringPage, type EngineeringView } from './pages/engineering-page.js'
import { DashboardPage } from './pages/dashboard-page.js'
import { ShipPage, type ShipView } from './pages/ship-page.js'
import { ExplorationPage, type ExplorationView } from './pages/exploration-page.js'

const api = new PhoenixApiClient()

export function App () {
  const [health, setHealth] = useState<HealthResponse>()
  const [actionCatalog, setActionCatalog] = useState<GameActionCatalogResponse>()
  const [catalogueDiagnostics, setCatalogueDiagnostics] = useState<CatalogueDiagnostics>()
  const [controlLayout, setControlLayout] = useState<ControlGridLayout>()
  const [actionPending, setActionPending] = useState<string>()
  const [lastActionResult, setLastActionResult] = useState<GameActionResult>()
  const [eliteStatusDiagnostics, setEliteStatusDiagnostics] = useState<EliteStatusSourceDiagnostics>()
  const [eliteJournalDiagnostics, setEliteJournalDiagnostics] = useState<EliteJournalSourceDiagnostics>()
  const [runtimeState, setRuntimeState] = useState<RuntimeState>()
  const [error, setError] = useState<string>()
  const [route, setRoute] = useState(readRoute)

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
        const command = parseDisplayCommand(JSON.parse(event.data))
        const parameters = new URLSearchParams({ name: command.systemName })
        if (command.selectedName) parameters.set('selected', command.selectedName)
        window.location.hash = `/navigation/system?${parameters.toString()}`
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Invalid display command received.')
      }
    })

    const handleRouteChange = (): void => setRoute(readRoute())
    window.addEventListener('hashchange', handleRouteChange)

    return () => {
      unsubscribeRuntime()
      unsubscribeDisplay()
      window.removeEventListener('hashchange', handleRouteChange)
    }
  }, [])

  if (route.section === 'developer') {
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
        view={route.view}
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

  if (route.section === 'controls') {
    return (
      <ControlsPage
        actionCatalog={actionCatalog}
        category={route.category}
        controlLayout={controlLayout}
        error={error}
        health={health}
        runtimeState={runtimeState}
        onExecuteAction={(actionId: string, operation: GameActionOperation) => (
          api.executeAction(actionId, operation)
        )}
        onSaveLayout={async layout => {
          const saved = await api.saveControlLayout(layout)
          setControlLayout(saved)
          return saved
        }}
      />
    )
  }

  if (route.section === 'copilot') {
    return <CopilotPage api={api} error={error} health={health} />
  }

  if (route.section === 'log') {
    return <LogPage api={api} error={error} health={health} />
  }

  if (route.section === 'navigation') {
    return (
      <NavigationPage
        api={api}
        error={error}
        health={health}
        runtimeState={runtimeState}
        selectedName={route.selectedName}
        systemName={route.systemName}
        view={route.view}
      />
    )
  }

  if (route.section === 'engineering') {
    return (
      <EngineeringPage
        api={api}
        error={error}
        health={health}
        runtimeState={runtimeState}
        view={route.view}
      />
    )
  }

  if (route.section === 'ship') {
    return (
      <ShipPage
        error={error}
        health={health}
        runtimeState={runtimeState}
        view={route.view}
      />
    )
  }

  if (route.section === 'exploration') {
    return (
      <ExplorationPage
        api={api}
        bodyName={route.bodyName}
        error={error}
        health={health}
        runtimeState={runtimeState}
        systemName={route.systemName}
        view={route.view}
      />
    )
  }

  return <DashboardPage api={api} health={health} error={error} runtimeState={runtimeState} />
}

type AppRoute =
  | { section: 'main' }
  | { section: 'copilot' }
  | { section: 'log' }
  | { section: 'navigation', view: NavigationView, systemName?: string, selectedName?: string }
  | { section: 'engineering', view: EngineeringView }
  | { section: 'ship', view: ShipView }
  | { section: 'exploration', view: ExplorationView, systemName?: string, bodyName?: string }
  | { section: 'controls', category: ControlCategory }
  | { section: 'developer', view: DeveloperView }

const CONTROL_CATEGORIES: ControlCategory[] = [
  'ship', 'combat', 'navigation', 'vessel', 'srv', 'on_foot', 'radio', 'emote', 'misc'
]

function readRoute (): AppRoute {
  if (typeof window === 'undefined') return { section: 'main' }
  if (/^#\/?copilot$/u.test(window.location.hash)) return { section: 'copilot' }
  if (/^#\/?log$/u.test(window.location.hash)) return { section: 'log' }
  const navigationMatch = window.location.hash.match(/^#\/?navigation\/(system|route)(?:\?(.*))?$/u)
  if (navigationMatch) {
    const parameters = new URLSearchParams(navigationMatch[2] ?? '')
    const systemName = parameters.get('name')?.trim() || undefined
    const selectedName = parameters.get('selected')?.trim() || undefined
    return {
      section: 'navigation',
      view: navigationMatch[1] as NavigationView,
      ...(systemName ? { systemName } : {}),
      ...(selectedName ? { selectedName } : {})
    }
  }
  const engineeringMaterialsMatch = window.location.hash.match(/^#\/?engineering\/materials\/(raw|manufactured|encoded|xeno)$/u)
  if (engineeringMaterialsMatch) {
    return {
      section: 'engineering',
      view: { type: 'materials', category: engineeringMaterialsMatch[1] as 'raw' | 'manufactured' | 'encoded' | 'xeno' }
    }
  }
  if (/^#\/?engineering\/engineers$/u.test(window.location.hash)) {
    return { section: 'engineering', view: { type: 'engineers' } }
  }
  const shipMatch = window.location.hash.match(/^#\/?ship\/(status|modules|cargo|inventory)$/u)
  if (shipMatch) {
    return { section: 'ship', view: shipMatch[1] as ShipView }
  }
  const explorationMatch = window.location.hash.match(/^#\/?exploration\/(ledger|body|biology|geology)(?:\?(.*))?$/u)
  if (explorationMatch) {
    const parameters = new URLSearchParams(explorationMatch[2] ?? '')
    const systemName = parameters.get('system')?.trim() || undefined
    const bodyName = parameters.get('body')?.trim() || undefined
    return {
      section: 'exploration',
      view: explorationMatch[1] as ExplorationView,
      ...(systemName ? { systemName } : {}),
      ...(bodyName ? { bodyName } : {})
    }
  }
  const engineeringBlueprintsMatch = window.location.hash.match(/^#\/?engineering\/blueprints(?:\?(.*))?$/u)
  if (engineeringBlueprintsMatch) {
    const symbol = new URLSearchParams(engineeringBlueprintsMatch[1] ?? '').get('symbol')?.trim() || undefined
    return {
      section: 'engineering',
      view: { type: 'blueprints', ...(symbol ? { symbol } : {}) }
    }
  }
  const controlsMatch = window.location.hash.match(/^#\/?controls(?:\/([a-z_]+))?$/)
  if (controlsMatch) {
    const category = CONTROL_CATEGORIES.find(candidate => candidate === controlsMatch[1]) ?? 'ship'
    return { section: 'controls', category }
  }
  const match = window.location.hash.match(/^#\/developer\/(overview|runtime|elite|health|tests|controls)$/)
  if (!match) return { section: 'main' }
  return { section: 'developer', view: match[1] as DeveloperView }
}
