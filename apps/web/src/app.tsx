import { useEffect, useState } from 'react'
import type { HealthResponse } from '@phoenix/contracts'
import { PhoenixApiClient } from './api/phoenix-api-client.js'

const api = new PhoenixApiClient()

export function App () {
  const [health, setHealth] = useState<HealthResponse>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    api.getHealth()
      .then(setHealth)
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Backend unavailable.'))
  }, [])

  return (
    <main className="shell">
      <header className="masthead">
        <div className="brand-mark">P</div>
        <div>
          <p className="eyebrow">Elite Dangerous companion</p>
          <h1>PHOENIX</h1>
        </div>
      </header>

      <section className="status-panel" aria-live="polite">
        <div>
          <p className="eyebrow">Infrastructure status</p>
          <h2>{health ? 'Core online' : error ? 'Core unavailable' : 'Establishing link…'}</h2>
        </div>
        <div className={`status-light ${health ? 'status-light--online' : ''}`} />

        {health && (
          <dl className="telemetry">
            <div><dt>API</dt><dd>v{health.apiVersion}</dd></div>
            <div><dt>Database</dt><dd>{health.database.engine} · {health.database.connected ? 'ready' : 'offline'}</dd></div>
            <div><dt>Link</dt><dd>frontend ↔ backend confirmed</dd></div>
          </dl>
        )}

        {error && <p className="error">{error}</p>}
      </section>
    </main>
  )
}

