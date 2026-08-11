import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ActivityLogEntrySchema,
  type ActivityLogEntry,
  type HealthResponse,
  type NavigationRoute,
  type RuntimeState
} from '@phoenix/contracts'
import type { PhoenixApi } from '../api/phoenix-api-client.js'
import { subscribePhoenixEvent } from '../api/phoenix-event-stream.js'
import { Page, PageContent, PageFooter, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'
import { useCopilotVoice } from '../features/copilot/copilot-voice-provider.js'

const navigation: NavigationItem[] = [
  { href: '#/', icon: '◇', id: 'overview', label: 'Dashboard' }
]

export interface DashboardPageProps {
  api: PhoenixApi
  error?: string
  health?: HealthResponse
  runtimeState?: RuntimeState
}

export function DashboardPage ({ api, error, health, runtimeState }: DashboardPageProps) {
  const voice = useCopilotVoice()
  const [route, setRoute] = useState<NavigationRoute>()
  const [activity, setActivity] = useState<ActivityLogEntry[]>([])
  const [dashboardError, setDashboardError] = useState<string>()

  useEffect(() => {
    let active = true
    void Promise.all([
      api.getNavigationRoute(),
      api.getActivityLog(24)
    ]).then(([nextRoute, log]) => {
      if (!active) return
      setRoute(nextRoute)
      setActivity(log.entries)
    }).catch(cause => setDashboardError(errorMessage(cause)))

    const unsubscribe = subscribePhoenixEvent(api, 'activity-entry', event => {
      try {
        const entry = ActivityLogEntrySchema.parse(JSON.parse(event.data))
        setActivity(current => [entry, ...current.filter(item => item.id !== entry.id)].slice(0, 24))
      } catch (cause) {
        setDashboardError(errorMessage(cause))
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [api])

  const cargo = runtimeState?.inventory.cargo?.items.reduce((total, item) => total + item.count, 0)
  const notableActivity = useMemo(
    () => activity.filter(entry => entry.importance !== 'trace').slice(0, 5),
    [activity]
  )
  const attention = useMemo(() => situationWarnings(runtimeState), [runtimeState])
  const routeSummary = summarizeRoute(route, runtimeState?.system.name)
  const shipName = runtimeState?.ship.name ?? runtimeState?.ship.definition?.displayName ?? runtimeState?.ship.typeId
  const placeName = runtimeState?.location.place?.name
  const currentSystem = runtimeState?.system.name

  return (
    <PhoenixShell
      activePrimaryItemId="dashboard"
      activeSecondaryItemId="overview"
      error={error ?? dashboardError ?? voice.error}
      health={health}
      secondaryNavigation={navigation}
    >
      <Page className="dashboard-page">
        <PageHeader
          title={runtimeState?.commander.name ? `Commander ${runtimeState.commander.name}` : 'Command dashboard'}
          eyebrow={locationLabel(runtimeState)}
          description={placeName && currentSystem ? `${placeName} · ${currentSystem}` : currentSystem ?? 'Waiting for live telemetry.'}
        />

        <PageContent>
          <div className="dashboard-grid">
            <DashboardCard className="dashboard-card--situation" title="Situation" action={<a href="#/navigation/system">Open navigation</a>}>
              <div className="dashboard-metric dashboard-metric--hero">
                <strong>{currentSystem ?? 'Unknown system'}</strong>
                <span>{placeName ?? humanize(runtimeState?.location.state ?? 'telemetry pending')}</span>
              </div>
              <dl className="dashboard-facts">
                <Fact label="Security" value={runtimeState?.system.security?.label} />
                <Fact label="Economy" value={runtimeState?.system.primaryEconomy?.label} />
                <Fact label="Allegiance" value={runtimeState?.system.allegiance} />
                <Fact label="Population" value={formatNumber(runtimeState?.system.population)} />
              </dl>
            </DashboardCard>

            <DashboardCard className="dashboard-card--copilot" title="Copilot" action={<a href="#copilot">Open channel</a>}>
              <div className="dashboard-copilot">
                <span className="dashboard-copilot__mark" aria-hidden="true">I</span>
                <div>
                  <strong>ICARUS</strong>
                  <span>{voice.status}</span>
                </div>
                <button
                  type="button"
                  className={voice.connected ? 'is-connected' : undefined}
                  onClick={() => voice.connected ? voice.disconnect() : void voice.connect()}
                >
                  {voice.connected
                    ? voice.hostLocation === 'remote' ? 'Disconnect desktop' : 'Disconnect'
                    : voice.hostLocation === 'remote' ? 'Connect desktop' : 'Connect voice'}
                </button>
              </div>
              <p className="dashboard-copilot__detail">
                {voice.hostLocation === 'remote'
                  ? 'Voice audio is hosted by the desktop browser.'
                  : voice.connected
                    ? (voice.audioStatus ?? 'Realtime voice channel active.')
                    : 'Connect once here to arm this device as the audio host.'}
              </p>
            </DashboardCard>

            <DashboardCard title="Current ship" action={<a href="#/controls/ship">Ship controls</a>}>
              <div className="dashboard-metric dashboard-metric--hero">
                <strong>{shipName ?? 'No ship identified'}</strong>
                <span>{runtimeState?.ship.identifier ?? runtimeState?.ship.definition?.displayName ?? 'Loadout pending'}</span>
              </div>
              <div className="dashboard-metrics">
                <Metric label="Hull" value={formatPercent(runtimeState?.ship.hullHealth)} />
                <Metric label="Cargo" value={cargo === undefined ? '—' : `${cargo} / ${formatCompact(runtimeState?.ship.cargoCapacity)}`} />
                <Metric label="Jump" value={runtimeState?.ship.maxJumpRange == null ? '—' : `${runtimeState.ship.maxJumpRange.toFixed(1)} ly`} />
              </div>
              <div className="dashboard-tags">
                <StatusTag active={runtimeState?.gameStatus?.flags.shieldsUp} label="Shields" />
                <StatusTag active={runtimeState?.gameStatus?.flags.hardpointsDeployed} label="Hardpoints" />
                <StatusTag active={runtimeState?.gameStatus?.flags.landingGearDown} label="Gear" />
                <StatusTag active={runtimeState?.gameStatus?.flags.lightsOn} label="Lights" />
              </div>
            </DashboardCard>

            <DashboardCard title="Route" action={<a href="#/navigation/route">Open route</a>}>
              <div className="dashboard-metric dashboard-metric--hero">
                <strong>{routeSummary.destination}</strong>
                <span>{routeSummary.detail}</span>
              </div>
              <div className="dashboard-route-line" aria-label="Route progress">
                <span>{currentSystem ?? 'Current'}</span>
                <i aria-hidden="true" />
                <span>{routeSummary.next}</span>
              </div>
            </DashboardCard>

            <DashboardCard className="dashboard-card--activity" title="Recent activity" action={<a href="#log">Open journal</a>}>
              {notableActivity.length === 0
                ? <p className="dashboard-empty">No recent activity retained.</p>
                : (
                    <ol className="dashboard-activity">
                      {notableActivity.map(entry => (
                        <li key={entry.id}>
                          <time dateTime={entry.timestamp}>{formatTime(entry.timestamp)}</time>
                          <span>{humanize(entry.event)}</span>
                          <small>{entry.source}</small>
                        </li>
                      ))}
                    </ol>
                  )}
            </DashboardCard>

            <DashboardCard className="dashboard-card--attention" title="Attention">
              {attention.length === 0
                ? <p className="dashboard-clear">No immediate telemetry warnings.</p>
                : (
                    <ul className="dashboard-attention">
                      {attention.map(item => <li key={item}>{item}</li>)}
                    </ul>
                  )}
            </DashboardCard>
          </div>
        </PageContent>

        <PageFooter>
          <span>Live operational overview</span>
          <span>{runtimeState?.updatedAt ? `Telemetry ${formatTime(runtimeState.updatedAt)}` : 'Telemetry pending'}</span>
        </PageFooter>
      </Page>
    </PhoenixShell>
  )
}

function DashboardCard ({
  action,
  children,
  className,
  title
}: {
  action?: ReactNode
  children: ReactNode
  className?: string
  title: string
}) {
  return (
    <section className={['dashboard-card', className].filter(Boolean).join(' ')}>
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      <div className="dashboard-card__body">{children}</div>
    </section>
  )
}

function Fact ({ label, value }: { label: string, value?: string | null }) {
  return <><dt>{label}</dt><dd>{value || '—'}</dd></>
}

function Metric ({ label, value }: { label: string, value: string }) {
  return <div className="dashboard-metric"><span>{label}</span><strong>{value}</strong></div>
}

function StatusTag ({ active, label }: { active?: boolean, label: string }) {
  return <span className={active ? 'is-active' : undefined}>{label}</span>
}

function situationWarnings (state?: RuntimeState): string[] {
  if (!state?.gameStatus) return []
  const warnings: string[] = []
  const { flags, flags2 } = state.gameStatus
  if (flags.inDanger) warnings.push('Ship telemetry reports immediate danger.')
  if (flags.beingInterdicted) warnings.push('Interdiction in progress.')
  if (flags.overheating) warnings.push('Ship temperature is critical.')
  if (flags.lowFuel) warnings.push('Main fuel level is low.')
  if (flags2.lowHealth) warnings.push('Commander health is low.')
  if (flags2.lowOxygen) warnings.push('Suit oxygen is low.')
  if (state.ship.hullHealth !== null && state.ship.hullHealth < 0.5) {
    warnings.push(`Hull integrity at ${formatPercent(state.ship.hullHealth)}.`)
  }
  return warnings
}

function summarizeRoute (route: NavigationRoute | undefined, currentSystem?: string | null) {
  const hops = route?.route ?? []
  if (hops.length === 0) return { destination: 'No route plotted', detail: 'Navigation computer idle', next: 'No destination' }
  const currentIndex = currentSystem ? hops.findIndex(hop => hop.system === currentSystem) : -1
  const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0
  const next = hops[Math.min(nextIndex, hops.length - 1)]?.system ?? hops[0]?.system ?? 'Unknown'
  const remaining = Math.max(0, hops.length - Math.max(currentIndex, 0) - 1)
  return {
    destination: hops.at(-1)?.system ?? next,
    detail: `${remaining} ${remaining === 1 ? 'jump' : 'jumps'} remaining`,
    next
  }
}

function locationLabel (state?: RuntimeState): string {
  if (!state) return 'Establishing telemetry link'
  if (state.location.state === 'unknown' && state.location.place?.kind === 'station') return 'Docked'
  if (state.location.state === 'unknown' && state.location.place?.kind === 'body') return 'Surface location'
  return humanize(state.location.state)
}

function formatPercent (value?: number | null): string {
  return value == null ? '—' : `${Math.round(value * 100)}%`
}

function formatCompact (value?: number | null): string {
  return value == null ? '—' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value)
}

function formatNumber (value?: number | null): string | undefined {
  return value == null ? undefined : new Intl.NumberFormat().format(value)
}

function formatTime (timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp))
}

function humanize (value: string): string {
  return value.replace(/[._-]+/gu, ' ').replace(/\b\w/gu, letter => letter.toUpperCase())
}

function errorMessage (cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Dashboard data unavailable.'
}
