import {
  Avatar,
  DashboardGrid,
  DescriptionItem,
  DescriptionList,
  EqualGrid,
  IconButton,
  Identity,
  Inline,
  ItemList,
  ItemListItem,
  Metric,
  PageFrame,
  Panel,
  Stack,
  Status,
  Widget
} from '@phoenix/ui'
import { CommanderSummaryWidget } from '../../components/commander-summary-widget.js'
import { formatPhoenixCredits } from '../../components/phoenix-credits.js'
import type { GalaxyMarketSignal, GameActionCatalogResponse, GameActionResult } from '@phoenix/contracts'
import type { PhoenixEventConnectionSnapshot } from '../../application/events/phoenix-event-hub.js'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import type { RuntimeStateSnapshot } from '../../application/runtime/runtime-state-store.js'
import type { DashboardControllerSnapshot } from './use-dashboard-controller.js'
import type { DashboardViewModel } from './dashboard-view-model.js'
import { DashboardRadioControls } from './dashboard-radio-controls.js'

export interface DashboardVoiceModel {
  connected: boolean
  error?: string
  mark: string
  name: string
  status: string
  transitioning: boolean
  connect(): Promise<void>
  disconnect(): void
}

export function DashboardPage({
  actions,
  controller,
  eventConnection,
  hrefFor,
  model,
  onExecuteAction,
  onInspectMarketSignal,
  onNavigate,
  runtime,
  voice
}: {
  actions?: GameActionCatalogResponse
  controller: DashboardControllerSnapshot
  eventConnection: PhoenixEventConnectionSnapshot
  hrefFor(route: PhoenixRoute): string
  model: DashboardViewModel
  onExecuteAction(actionId: string): Promise<GameActionResult>
  onInspectMarketSignal(signal: GalaxyMarketSignal): void
  onNavigate(route: PhoenixRoute): void
  runtime: RuntimeStateSnapshot
  voice: DashboardVoiceModel
}) {
  const attention = [
    ...model.warnings,
    ...(runtime.status === 'error' ? [runtime.error] : []),
    ...(controller.error ? [controller.error] : []),
    ...(voice.error ? [voice.error] : []),
    ...(eventConnection.state === 'error' ? [eventConnection.error ?? 'Live event connection unavailable.'] : [])
  ]

  return (
    <PageFrame className="dashboard-page" aria-busy={controller.status === 'loading'}>
      {attention.length > 0
        ? (
            <Panel className="dashboard-alerts" title="Attention" variant="danger">
              <ItemList density="compact">
                {attention.map(message => <ItemListItem key={message} title={message} />)}
              </ItemList>
            </Panel>
          )
        : null}
      <DashboardGrid
        gap="xs"
        lastRow={(
          <>
            <Widget
              aria-label="Material watchlist"
              eyebrow="Material watchlist"
              link={<RouteLink hrefFor={hrefFor} onNavigate={onNavigate} route={{ kind: 'information', section: 'engineering', view: 'projects' }}>Open projects</RouteLink>}
              scrollable
            >
              {!controller.materialWatchlist
                ? <Status tone="muted">Loading engineering plans…</Status>
                : controller.materialWatchlist.activeProjectCount === 0
                  ? <Status tone="muted">No active engineering projects. Choose a blueprint to start planning.</Status>
                  : controller.materialWatchlist.materials.length === 0
                    ? <Status tone="positive">All planned blueprint materials are currently in inventory.</Status>
                    : (
                        <ul className="dashboard-material-watchlist">
                          {controller.materialWatchlist.materials.slice(0, 8).map(material => (
                            <li key={material.materialId}>
                              <span>{material.materialName}</span>
                              <span>{material.owned}/{material.required}</span>
                            </li>
                          ))}
                        </ul>
                      )}
            </Widget>

            <Widget
              aria-label="Commander log"
              eyebrow="Commander log"
              link={<RouteLink hrefFor={hrefFor} onNavigate={onNavigate} route={{ kind: 'journal', view: 'journal' }}>Open journal</RouteLink>}
              scrollable
            >
              {model.commanderLog.length === 0
                ? <Status tone="muted">{controller.status === 'loading' ? 'Loading commander history…' : 'No notable commander events retained.'}</Status>
                : (
                    <ItemList density="compact">
                      {model.commanderLog.map(entry => (
                        <ItemListItem
                          data-tone={entry.tone}
                          description={entry.detail}
                          eyebrow={entry.category}
                          key={entry.id}
                          leading={<time dateTime={entry.timestamp}>{entry.time}</time>}
                          title={entry.title}
                          trailing={entry.value}
                        />
                      ))}
                    </ItemList>
                  )}
            </Widget>

            <Widget
              aria-label="Local traffic"
              eyebrow="Local traffic"
              link={<RouteLink hrefFor={hrefFor} onNavigate={onNavigate} route={{ kind: 'information', section: 'comms', view: 'traffic' }}>Open traffic</RouteLink>}
              scrollable
            >
              {!controller.localTraffic
                ? <Status tone="muted">{controller.status === 'loading' ? 'Listening for local traffic…' : 'Local traffic unavailable.'}</Status>
                : model.localTraffic.length === 0
                  ? <Status tone="muted">No recent local communications observed.</Status>
                : (
                    <ItemList density="compact">
                      {model.localTraffic.map(entry => (
                        <ItemListItem
                          description={entry.message}
                          eyebrow={`${entry.scope} · ${entry.channel}`}
                          key={entry.id}
                          title={entry.correspondent}
                          trailing={<time dateTime={entry.timestamp}>{entry.relativeTime}</time>}
                        />
                      ))}
                    </ItemList>
                  )}
            </Widget>

            <Widget
              aria-label="Copilot"
              eyebrow="Copilot"
              link={<RouteLink hrefFor={hrefFor} onNavigate={onNavigate} route={{ kind: 'copilot', view: 'chat' }}>Open channel</RouteLink>}
            >
              <Stack fill justify="center">
                <Inline align="center" justify="space-between">
                  <Identity
                    title={voice.name}
                    detail={<Status tone={voice.connected ? 'positive' : 'muted'}>{voice.status}</Status>}
                    leading={<Avatar aria-hidden="true">{voice.mark}</Avatar>}
                  />
                  <IconButton
                    aria-pressed={voice.connected}
                    busy={voice.transitioning}
                    label={voice.connected ? 'Disconnect voice' : 'Connect voice'}
                    size="lg"
                    onClick={() => voice.connected ? voice.disconnect() : void voice.connect()}
                  >
                    <MicrophoneIcon />
                  </IconButton>
                </Inline>
              </Stack>
            </Widget>

            <Widget
              className="span-two"
              eyebrow="GalNet radio"
              link={<RouteLink hrefFor={hrefFor} onNavigate={onNavigate} route={{ kind: 'information', section: 'comms', view: 'radio' }}>Open remote</RouteLink>}
            >
              <DashboardRadioControls actionCatalog={actions} onExecute={onExecuteAction} />
            </Widget>
          </>
        )}
      >
        <CommanderSummaryWidget className="span-full" {...model.commander} />

        <Widget
          className="span-two"
          detail={model.situation.place}
          eyebrow="Current location"
          heading={model.situation.system.toUpperCase()}
          link={<RouteLink hrefFor={hrefFor} onNavigate={onNavigate} route={{ kind: 'information', section: 'galaxy', view: 'system' }}>Open galaxy</RouteLink>}
        >
          <Stack gap="sm">
            <DescriptionList columns="two" density="compact">
              <DescriptionItem label="Security" value={model.situation.security} />
              <DescriptionItem label="Economy" value={model.situation.economy} />
              <DescriptionItem label="Allegiance" value={model.situation.allegiance} />
              <DescriptionItem label="Population" value={model.situation.population} />
            </DescriptionList>
          </Stack>
        </Widget>

        <Widget
          aria-label="Market signals"
          className="dashboard-market-signals-widget"
          eyebrow="Market signals"
          link={<RouteLink hrefFor={hrefFor} onNavigate={onNavigate} route={{
            kind: 'information',
            section: 'galaxy',
            view: 'database',
            ...(controller.marketSignals?.configuration
              ? { savedQueryId: controller.marketSignals.configuration.id, selectedQueryId: 'market-signals' as const }
              : { selectedQueryId: 'market-signals' as const })
          }}>{controller.marketSignals?.configuration ? 'Open signals' : 'Configure'}</RouteLink>}
          scrollable
        >
          {controller.marketSignalsError
            ? <Status tone="muted">Market intelligence unavailable.</Status>
            : !controller.marketSignals
              ? <Status tone="muted">Scanning local markets…</Status>
              : controller.marketSignals.state === 'not-configured'
                ? <Status tone="muted">Save a Market Signals query and select it for the dashboard.</Status>
                : controller.marketSignals.state === 'location-unknown'
                  ? <Status tone="muted">Current system unknown.</Status>
                  : controller.marketSignals.result!.signals.length === 0
                    ? <Status tone="muted">No notable local prices match your filters.</Status>
                    : (
                        <ul className="dashboard-market-signals">
                          {controller.marketSignals.result!.signals.map(signal => (
                            <li key={`${signal.side}:${signal.commodityName}:${signal.marketId ?? signal.stationName}`}>
                              <a
                                href={hrefFor({ kind: 'information', section: 'galaxy', view: 'database', selectedQueryId: 'commodity-markets' })}
                                onClick={event => {
                                  event.preventDefault()
                                  onInspectMarketSignal(signal)
                                }}
                              ><span>{signal.commodityName}</span><small>{signal.side === 'buy' ? 'Buy' : 'Sell'} {formatPhoenixCredits(signal.price)} · {signal.stationName}</small></a>
                              <span className="dashboard-market-signal-summary">
                                <span>{signal.side === 'buy' ? '−' : '+'}{Math.round(signal.deviationPercent)}%</span>
                                <small>{signal.unlimitedVolume ? '∞ t' : `${signal.volume.toLocaleString('en-CH')} t`}</small>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
        </Widget>

        <Widget
          detail={model.ship.identifier}
          eyebrow="Current ship"
          heading={model.ship.name.toUpperCase()}
          link={<RouteLink hrefFor={hrefFor} onNavigate={onNavigate} route={{ kind: 'controls', category: 'ship' }}>Ship controls</RouteLink>}
        >
          <Stack gap="sm">
            <EqualGrid columns={3} gap="xs">
              <Metric density="compact" label="Hull" value={model.ship.hull} />
              <Metric density="compact" label="Cargo" value={model.ship.cargo} />
              <Metric density="compact" label="Jump" value={model.ship.jumpRange} />
            </EqualGrid>
          </Stack>
        </Widget>

        <Widget
          className="dashboard-route"
          detail={model.route.detail}
          eyebrow="Route"
          heading={model.route.destination.toUpperCase()}
          link={<RouteLink hrefFor={hrefFor} onNavigate={onNavigate} route={{ kind: 'information', section: 'galaxy', view: 'route' }}>Open route</RouteLink>}
        >
          <Stack gap="sm">
            <DescriptionList columns="one" density="compact">
              <DescriptionItem label="Next jump" title={model.route.nextSystem} value={model.route.nextSystem} />
              <DescriptionItem label="Star class" value={model.route.nextStarClass} />
            </DescriptionList>
          </Stack>
        </Widget>
      </DashboardGrid>
    </PageFrame>
  )
}

function RouteLink({
  children,
  hrefFor,
  onNavigate,
  route
}: {
  children: string
  hrefFor(route: PhoenixRoute): string
  onNavigate(route: PhoenixRoute): void
  route: PhoenixRoute
}) {
  return (
    <a
      href={hrefFor(route)}
      onClick={event => {
        event.preventDefault()
        onNavigate(route)
      }}
    >
      {children}
    </a>
  )
}

function MicrophoneIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M6 11v1a6 6 0 0 0 12 0v-1M12 18v3M9 21h6" />
    </svg>
  )
}
