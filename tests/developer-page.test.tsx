import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { createEmptyRuntimeState } from '@phoenix/contracts'
import { DeveloperPage } from '../apps/web/src/pages/developer-page.js'

test('the developer area uses the shared shell and its own secondary navigation', () => {
  const markup = renderToStaticMarkup(
    <DeveloperPage
      health={{
        apiVersion: '1',
        database: { connected: true, engine: 'sqlite' },
        name: 'PHOENIX',
        status: 'ok',
        timestamp: '2026-08-10T00:00:00.000Z'
      }}
      runtimeState={createEmptyRuntimeState()}
      view="runtime"
    />
  )

  expect(markup).toContain('class="app-shell"')
  expect(markup).toContain('aria-label="Developer tools"')
  expect(markup).toContain('href="#/developer/health"')
  expect(markup).toContain('aria-current="page"')
  expect(markup).toContain('<main class="page">')
  expect(markup).toContain('Validated runtime snapshot')
  expect(markup).toContain('&quot;schemaVersion&quot;: 1')
})

test('the control console renders catalogue actions through the recording backend', () => {
  const markup = renderToStaticMarkup(
    <DeveloperPage
      actionCatalog={{
        backend: {
          id: 'recording',
          available: true,
          simulated: true,
          detail: 'Recording backend active.'
        },
        actions: [{
          available: true,
          binding: { key: 'L', modifiers: [], display: 'L' },
          definition: {
            id: 'ship.lights.toggle',
            label: 'Ship Lights',
            description: 'Toggle the ship exterior lights.',
            category: 'ship',
            inputMode: 'tap',
            risk: 'routine',
            eliteBinding: 'ShipSpotLightToggle',
            telemetryKey: 'lightsOn'
          },
          unavailableReason: null
        }]
      }}
      view="controls"
    />
  )

  expect(markup).toContain('Recording backend active.')
  expect(markup).toContain('ship.lights.toggle')
  expect(markup).toContain('ShipSpotLightToggle')
  expect(markup).toContain('Test action')
})

test('the Elite developer surface renders source diagnostics and normalized status', () => {
  const markup = renderToStaticMarkup(
    <DeveloperPage
      catalogueDiagnostics={{
        shipCount: 47,
        shipAliasCount: 83,
        moduleCount: 1068,
        shipSource: 'EDCD Coriolis Data',
        moduleSource: 'EDCD FDevIDs',
        currentShip: {
          typeId: 'cobramkiii',
          displayName: 'Cobra Mk III',
          shipResolved: true,
          moduleCount: 4,
          catalogueModules: 4,
          inferredModules: 0
        }
      }}
      eliteStatusDiagnostics={{
        directory: '/game',
        filePath: '/game/Status.json',
        watching: true,
        fileAvailable: true,
        lastReadAt: '2026-08-10T14:00:01Z',
        lastGameTimestamp: '2026-08-10T14:00:00Z',
        error: null
      }}
      runtimeState={createEmptyRuntimeState()}
      view="elite"
    />
  )

  expect(markup).toContain('Game catalogue diagnostics')
  expect(markup).toContain('Cobra Mk III')
  expect(markup).toContain('Status source diagnostics')
  expect(markup).toContain('/game/Status.json')
  expect(markup).toContain('Normalized game status')
})
