import { useState } from 'react'
import { PlaceholderPage } from './components/shell/placeholder-page.js'
import { PhoenixApplicationShell } from './components/shell/phoenix-application-shell.js'
import type { WorkspaceDesktop } from './components/shell/workspace-desktop.js'

export function App() {
  const [activeDesktop, setActiveDesktop] = useState<WorkspaceDesktop>('info')

  return (
    <PhoenixApplicationShell
      activeDesktop={activeDesktop}
      onNavigate={setActiveDesktop}
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
