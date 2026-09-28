import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { PageFrame, PageHeader } from '@phoenix/ui'
import { PhoenixApplicationShell } from '../../web/src/components/shell/phoenix-application-shell'
import { CommanderLogPage } from '../../web/src/features/journal/commander-log-page'
import { developerNavigationItems, journalContext, journalNavigationItems } from '../../web/src/features/journal/journal-navigation'
import { DEFAULT_ROUTE, defaultRouteForWorkspace, workspaceForRoute, type PhoenixRoute } from '../../web/src/application/navigation/phoenix-route'
import type { PhoenixApi } from '../../web/src/application/api/phoenix-api'
import type { PhoenixEventHub } from '../../web/src/application/events/phoenix-event-hub'

const api = {
  getCommanderLog: async () => ({
    schemaVersion: 1, retained: 65,
    entries: Array.from({ length: 65 }, (_, index) => ({
      id: String(index), schemaVersion: 1,
      timestamp: new Date(Date.UTC(2026, 8, 28, 12) - index * 3600000).toISOString(),
      category: index % 2 ? 'exploration' : 'engineering',
      kind: index % 2 ? 'exploration.biological_analysis_completed' : 'engineering.materials_traded',
      title: index % 2 ? 'Biological analysis completed' : 'Materials traded',
      detail: index % 2 ? 'Fonticulua Fluctus · Example A 7' : '12 × Refined Focus Crystals → 2 × Conductive Polymers · Example Station',
      creditDelta: null, tone: 'positive', sourceEvent: index % 2 ? 'ScanOrganic' : 'MaterialTrade'
    }))
  })
} as unknown as PhoenixApi
const events = { subscribe: () => () => undefined } as unknown as PhoenixEventHub

function LogShell () {
  const [route, setRoute] = useState<PhoenixRoute>({ kind: 'journal', view: 'commander' })
  const placeholder = <PageFrame><PageHeader title="Diagnostic fixture" /></PageFrame>
  return <div className="tablet-shell-story"><PhoenixApplicationShell
    activeDesktop={workspaceForRoute(route)} informationRoute={DEFAULT_ROUTE}
    controls={null} copilot={null} information={null} macros={null} settings={null} telemetry={null}
    journal={<CommanderLogPage api={api} events={events} />}
    journalContextItems={journalNavigationItems} journalCurrentContext={journalContext(route)}
    developer={placeholder} developerContextItems={developerNavigationItems} developerCurrentContext={journalContext(route)}
    onNavigateRoute={setRoute} onNavigateWorkspace={workspace => setRoute(defaultRouteForWorkspace(workspace))}
  /></div>
}

const meta = { title: 'Shell/Commander log', component: LogShell, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof LogShell>
export default meta
type Story = StoryObj<typeof meta>
export const PlayerHistory: Story = {}
