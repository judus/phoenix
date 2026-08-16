import { PlaceholderPage } from './components/shell/placeholder-page.js'
import { PhoenixApplicationShell } from './components/shell/phoenix-application-shell.js'
import { isInformationRoute, workspaceForRoute } from './application/navigation/phoenix-route.js'
import type { PhoenixRouter } from './application/navigation/phoenix-router.js'
import { usePhoenixRoute } from './application/navigation/use-phoenix-route.js'
import type { PhoenixApplicationServices } from './bootstrap/create-application.js'
import { PairingGate } from './bootstrap/pairing-gate.js'
import { PhoenixProviders } from './bootstrap/providers.js'

export function App({ application }: { application: PhoenixApplicationServices }) {
  return (
    <PairingGate api={application.api}>
      <PhoenixProviders application={application}>
        <PhoenixApplication router={application.router} />
      </PhoenixProviders>
    </PairingGate>
  )
}

function PhoenixApplication({ router }: { router: PhoenixRouter }) {
  const route = usePhoenixRoute(router)
  const informationRoute = isInformationRoute(route) ? route : router.getRememberedInformationRoute()

  return (
    <PhoenixApplicationShell
      activeDesktop={workspaceForRoute(route)}
      informationRoute={informationRoute}
      onNavigateRoute={router.push}
      onNavigateWorkspace={(workspace) => router.push(router.routeForWorkspace(workspace))}
      controls={<PlaceholderPage context="Controls" title="Flight controls" description="Ship and game command surfaces" />}
      copilot={<PlaceholderPage context="Copilot" title="Flight assistant" description="Conversation and current task context" />}
      developer={<PlaceholderPage context="Developer" title="Developer tools" description="Runtime inspection and diagnostics" />}
      information={null}
      journal={<PlaceholderPage context="Journal" title="Event log" description="Recent game and application events" />}
      macros={<PlaceholderPage context="Macros" title="Command macros" description="Stored command sequences" />}
      settings={<PlaceholderPage context="Settings" title="Application settings" description="Display, connection and control preferences" />}
      telemetry={<PlaceholderPage context="Telemetry" title="Numpad" description="Telemetry and direct-entry controls" />}
    />
  )
}
