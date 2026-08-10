import { useEffect, useState } from 'react'
import {
  RuntimeStateSchema,
  type CatalogueDiagnostics,
  type GameActionCatalogResponse,
  type GameActionResult,
  type EliteJournalSourceDiagnostics,
  type EliteStatusSourceDiagnostics,
  type HealthResponse,
  type RuntimeState
} from '@phoenix/contracts'
import { PhoenixApiClient } from './api/phoenix-api-client.js'
import { DeveloperPage, type DeveloperView } from './pages/developer-page.js'
import { TemplatePage } from './pages/template-page.js'

const api = new PhoenixApiClient()

export function App () {
  const [health, setHealth] = useState<HealthResponse>()
  const [actionCatalog, setActionCatalog] = useState<GameActionCatalogResponse>()
  const [catalogueDiagnostics, setCatalogueDiagnostics] = useState<CatalogueDiagnostics>()
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

    api.getDeveloperActions()
      .then(setActionCatalog)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Action catalogue unavailable.'))

    api.getCatalogueDiagnostics()
      .then(setCatalogueDiagnostics)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Game catalogue diagnostics unavailable.'))

    api.getEliteStatusDiagnostics()
      .then(setEliteStatusDiagnostics)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Elite status diagnostics unavailable.'))

    api.getEliteJournalDiagnostics()
      .then(setEliteJournalDiagnostics)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Elite journal diagnostics unavailable.'))

    const eventSource = new EventSource(api.runtimeStateStreamUrl())
    eventSource.addEventListener('runtime-state', event => {
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

    const handleRouteChange = (): void => setRoute(readRoute())
    window.addEventListener('hashchange', handleRouteChange)

    return () => {
      eventSource.close()
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

  return <TemplatePage health={health} error={error} runtimeState={runtimeState} />
}

type AppRoute = { section: 'main' } | { section: 'developer', view: DeveloperView }

function readRoute (): AppRoute {
  if (typeof window === 'undefined') return { section: 'main' }
  const match = window.location.hash.match(/^#\/developer\/(overview|runtime|elite|health|tests|controls)$/)
  if (!match) return { section: 'main' }
  return { section: 'developer', view: match[1] as DeveloperView }
}
