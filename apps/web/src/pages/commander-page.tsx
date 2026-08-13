import type { HealthResponse, RuntimeState } from '@phoenix/contracts'
import { Page, PageContent, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'
import { CommanderInventory } from './ship-page.js'

export type CommanderView = 'overview' | 'inventory' | 'progress'

const navigation: NavigationItem[] = [
  { href: '#/commander/overview', icon: '♙', id: 'overview', label: 'Commander overview' },
  { href: '#/commander/inventory', icon: '▦', id: 'inventory', label: 'Personal inventory' },
  { href: '#/commander/progress', icon: '△', id: 'progress', label: 'Commander progress' }
]

export function CommanderPage ({ error, health, runtimeState, view }: {
  error?: string
  health?: HealthResponse
  runtimeState?: RuntimeState
  view: CommanderView
}) {
  const title = runtimeState?.commander.name ? `Commander ${runtimeState.commander.name}` : 'Commander'
  return (
    <PhoenixShell
      activePrimaryItemId="commander"
      activeSecondaryItemId={view}
      error={error}
      health={health}
      secondaryNavigation={navigation}
    >
      <Page className="commander-page">
        <PageHeader
          title={title}
          eyebrow={view === 'inventory' ? 'Personal stores' : view === 'progress' ? 'Career progress' : 'Commander record'}
          description={view === 'overview' ? 'Identity, current situation, and recorded career status.' : undefined}
        />
        <PageContent>
          {!runtimeState
            ? <p>Waiting for commander telemetry…</p>
            : view === 'inventory'
              ? <CommanderInventory state={runtimeState} />
              : <CommanderRecord state={runtimeState} progressOnly={view === 'progress'} />}
        </PageContent>
      </Page>
    </PhoenixShell>
  )
}

function CommanderRecord ({ progressOnly, state }: { progressOnly: boolean, state: RuntimeState }) {
  const ranks = Object.entries(state.commander.ranks)
  return (
    <div className="ship-sections">
      {!progressOnly && (
        <section className="content-section">
          <h2 className="section-heading">Current situation</h2>
          <table className="data-table"><tbody>
            <tr><th>Commander</th><td>{state.commander.name ?? 'Unknown'}</td></tr>
            <tr><th>System</th><td>{state.system.name ?? 'Unknown'}</td></tr>
            <tr><th>Location</th><td>{state.location.place?.name ?? state.location.state}</td></tr>
            <tr><th>Current ship</th><td>{state.ship.name ?? state.ship.definition?.displayName ?? state.ship.typeId ?? 'Unknown'}</td></tr>
          </tbody></table>
        </section>
      )}
      <section className="content-section">
        <h2 className="section-heading">Ranks</h2>
        <table className="data-table"><thead><tr><th>Discipline</th><th>Rank level</th><th>Progress</th></tr></thead><tbody>
          {ranks.map(([discipline, rank]) => (
            <tr key={discipline}>
              <td>{humanize(discipline)}</td>
              <td>{rank ?? '—'}</td>
              <td>{state.commander.rankProgress[discipline as keyof typeof state.commander.rankProgress] ?? '—'}{state.commander.rankProgress[discipline as keyof typeof state.commander.rankProgress] !== null ? '%' : ''}</td>
            </tr>
          ))}
        </tbody></table>
      </section>
    </div>
  )
}

function humanize (value: string): string {
  return value.replace(/_/g, ' ').replace(/^./, character => character.toUpperCase())
}
