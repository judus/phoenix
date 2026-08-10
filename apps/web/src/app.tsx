import { useEffect, useState } from 'react'
import type { HealthResponse } from '@phoenix/contracts'
import { PhoenixApiClient } from './api/phoenix-api-client.js'
import { TemplatePage } from './pages/template-page.js'

const api = new PhoenixApiClient()

export function App () {
  const [health, setHealth] = useState<HealthResponse>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    api.getHealth()
      .then(setHealth)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Backend unavailable.'))
  }, [])

  return <TemplatePage health={health} error={error} />
}
