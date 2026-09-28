import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { createEmptyRuntimeState, type CatalogueSuggestionKind, type GalaxyQueryId } from '@phoenix/contracts'
import { PhoenixApplicationShell } from '../../web/src/components/shell/phoenix-application-shell'
import { GalaxyPage } from '../../web/src/features/galaxy/galaxy-page'
import { GalaxyQuerySessionStore } from '../../web/src/features/galaxy/galaxy-query-session-store'
import type { PhoenixApi } from '../../web/src/application/api/phoenix-api'
import type { PhoenixRoute } from '../../web/src/application/navigation/phoenix-route'

const vocabulary = {
  ship: ['Cobra MkIII', 'Cobra MkIV', 'Cobra MkV', 'Type-11 Prospector'],
  module: ['Point Defence', 'Guardian FSD Booster', 'Mk II Gravity Optimised Thrusters'],
  commodity: ['Gold', 'Advanced Catalysers', 'Water Purifiers']
}
function SuggestionShell({ queryId = 'outfitting-stock', offline = false }: { queryId?: GalaxyQueryId, offline?: boolean }) {
  const [route, setRoute] = useState<PhoenixRoute>({ kind: 'information', section: 'galaxy', view: 'database', selectedQueryId: queryId })
  const [sessions] = useState(() => new GalaxyQuerySessionStore())
  const [api] = useState(() => ({ getCatalogueSuggestions: async (kind: CatalogueSuggestionKind, query: string) => {
    if (offline) throw new Error('Offline fixture')
    return vocabulary[kind].filter(label => label.toLowerCase().includes(query.trim().toLowerCase())).map(label => ({ label, value: kind === 'commodity' ? label.replaceAll(' ', '') : label, source: kind === 'commodity' ? 'Elite' : 'Spansh' }))
  } }) as unknown as PhoenixApi)
  const state = createEmptyRuntimeState()
  state.system.name = 'Sol'
  const information = route.kind === 'information' && route.section === 'galaxy'
    ? <GalaxyPage api={api} controller={{ status: 'idle' }} onNavigate={setRoute} querySessions={sessions} route={route} runtime={{ status: 'ready', state }} /> : null
  return <div className="tablet-shell-story"><PhoenixApplicationShell activeDesktop="info"
    informationRoute={route.kind === 'information' ? route : { kind: 'information', section: 'galaxy', view: 'database' }}
    information={information} controls={null} copilot={null} macros={null} settings={null} telemetry={null} journal={null}
    onNavigateRoute={setRoute} onNavigateWorkspace={() => undefined} /></div>
}

const meta = { title: 'Shell/Catalogue suggestions', component: SuggestionShell, parameters: { layout: 'fullscreen' } } satisfies Meta<typeof SuggestionShell>
export default meta
type Story = StoryObj<typeof meta>
export const Modules: Story = {}
export const Ships: Story = { args: { queryId: 'shipyards' } }
export const Commodities: Story = { args: { queryId: 'commodity-markets' } }
export const Offline: Story = { args: { offline: true } }
