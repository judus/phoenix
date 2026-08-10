import { useEffect, useState } from 'react'
import {
  RuntimeStateSchema,
  type HealthResponse,
  type RuntimeState
} from '@phoenix/contracts'
import { PhoenixApiClient } from './api/phoenix-api-client.js'
import { DeveloperPage, type DeveloperView } from './pages/developer-page.js'
import { TemplatePage } from './pages/template-page.js'

const api = new PhoenixApiClient()

export function App () {
  const [health, setHealth] = useState<HealthResponse>()
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

    const eventSource = new EventSource(api.runtimeStateStreamUrl())
    eventSource.addEventListener('runtime-state', event => {
      try {
        setRuntimeState(RuntimeStateSchema.parse(JSON.parse(event.data)))
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
        error={error}
        health={health}
        runtimeState={runtimeState}
        view={route.view}
      />
    )
  }

  return <TemplatePage health={health} error={error} runtimeState={runtimeState} />
}

type AppRoute = { section: 'main' } | { section: 'developer', view: DeveloperView }

function readRoute (): AppRoute {
  if (typeof window === 'undefined') return { section: 'main' }
  const match = window.location.hash.match(/^#\/developer\/(overview|runtime|health|tests|controls)$/)
  if (!match) return { section: 'main' }
  return { section: 'developer', view: match[1] as DeveloperView }
}
