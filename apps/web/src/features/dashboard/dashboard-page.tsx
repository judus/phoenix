import {
  DashboardGrid,
  DescriptionItem,
  DescriptionList,
  EqualGrid,
  ItemList,
  ItemListItem,
  Metric,
  PageFrame,
  Panel,
  Stack,
  Status,
  Widget
} from '@phoenix/ui'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CommanderSummaryWidget } from '../../components/commander-summary-widget.js'
import { formatPhoenixCredits } from '../../components/phoenix-credits.js'
import type { GameActionCatalogResponse, GameActionResult } from '@phoenix/contracts'
import type { PhoenixEventConnectionSnapshot } from '../../application/events/phoenix-event-hub.js'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import type { RuntimeStateSnapshot } from '../../application/runtime/runtime-state-store.js'
import type { DashboardControllerSnapshot } from './use-dashboard-controller.js'
import type { DashboardViewModel } from './dashboard-view-model.js'
import { DashboardCommandControls, type DashboardCommandVoice } from './dashboard-command-controls.js'
import { bottomAlignedRowTailSpace } from './scrollable-log.js'

export interface DashboardVoiceModel extends DashboardCommandVoice {
  error?: string
}

export function DashboardPage({
  actions,
  controller,
  eventConnection,
  hrefFor,
  model,
  onExecuteAction,
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
  onNavigate(route: PhoenixRoute): void
  runtime: RuntimeStateSnapshot
  voice: DashboardVoiceModel
}) {
  const commanderLogBodyRef = useRef<HTMLDivElement>(null)
  const [dismissedAttention, setDismissedAttention] = useState<string | null>(null)
  const latestCommanderLogId = model.commanderLog.at(-1)?.id

  useLayoutEffect(() => {
    const body = commanderLogBodyRef.current
    if (!body) return

    const alignRows = () => alignCommanderLogRows(body)
    alignRows()
    if (typeof ResizeObserver === 'undefined') return

    const resizeObserver = new ResizeObserver(alignRows)
    resizeObserver.observe(body)
    const list = body.querySelector<HTMLElement>(':scope > .item-list')
    if (list) resizeObserver.observe(list)
    return () => resizeObserver.disconnect()
  }, [latestCommanderLogId])

  const attention = [
    ...model.warnings,
    ...(runtime.status === 'error' ? [runtime.error] : []),
    ...(controller.error ? [controller.error] : []),
    ...(voice.error ? [voice.error] : []),
    ...(eventConnection.state === 'error' ? [eventConnection.error ?? 'Live event connection unavailable.'] : [])
  ]
  const attentionKey = attention.join('\u0000')

  useEffect(() => {
    if (attention.length === 0) setDismissedAttention(null)
  }, [attention.length])

  return (
    <PageFrame className="dashboard-page" layout="fit" aria-busy={controller.status === 'loading'}>
      {attention.length > 0 && attentionKey !== dismissedAttention
        ? (
            <Panel
              actions={(
                <button
                  aria-label="Dismiss dashboard alert"
                  className="dashboard-alert-dismiss"
                  onClick={() => setDismissedAttention(attentionKey)}
                  type="button"
                >Dismiss</button>
              )}
              className="dashboard-alerts"
              role="alert"
              title="Attention"
              variant="danger"
            >
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
              autoHideScrollbar
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
                              <span className="numeric text-xs">{material.owned}/{material.required}</span>
                            </li>
                          ))}
                        </ul>
                      )}
            </Widget>

            <Widget
              aria-label="Commander log"
              autoHideScrollbar
              bodyRef={commanderLogBodyRef}
              className="dashboard-commander-log-widget"
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
                          eyebrow={<><time dateTime={entry.timestamp}>{entry.dateTime}</time> | {entry.category}</>}
                          key={entry.id}
                          title={entry.title}
                          trailing={entry.value === null ? null : <span className="currency">{entry.value}</span>}
                        />
                      ))}
                    </ItemList>
                  )}
            </Widget>

            <Widget
              aria-label="Local traffic"
              autoHideScrollbar
              eyebrow="Local traffic"
              link={<RouteLink hrefFor={hrefFor} onNavigate={onNavigate} route={{ kind: 'information', section: 'comms', view: 'traffic' }}>Traffic log</RouteLink>}
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

          </>
        )}
      >
        <CommanderSummaryWidget className="span-two" {...model.commander} />

        <DashboardCommandControls actions={actions} onExecute={onExecuteAction} voice={voice} />

        <Widget
          className="dashboard-location-widget span-two"
          detail={model.situation.place}
          eyebrow="Current location"
          heading={model.situation.system.toUpperCase()}
          link={<RouteLink hrefFor={hrefFor} onNavigate={onNavigate} route={{ kind: 'information', section: 'galaxy', view: 'system' }}>System schematic</RouteLink>}
        >
          <Stack gap="sm">
            <DescriptionList className="dashboard-operational-list" columns="two" density="compact">
              <DescriptionItem label="Security" value={model.situation.security} />
              <DescriptionItem label="Economy" value={model.situation.economy} />
              <DescriptionItem label="Allegiance" value={model.situation.allegiance} />
              <DescriptionItem label="Population" value={<span className="numeric">{model.situation.population}</span>} />
            </DescriptionList>
          </Stack>
        </Widget>

        <Widget
          aria-label="Market signals"
          autoHideScrollbar
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
                              <div><span>{signal.commodityName}</span><small>{signal.side === 'buy' ? 'Buy' : 'Sell'} {formatPhoenixCredits(signal.price)} · {signal.stationName}</small></div>
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
          className="dashboard-ship-widget"
          detail={model.ship.identifier}
          eyebrow="Current ship"
          heading={model.ship.name.toUpperCase()}
          link={<RouteLink hrefFor={hrefFor} onNavigate={onNavigate} route={{ kind: 'information', section: 'fleet', view: 'current-overview' }}>View ship</RouteLink>}
        >
          <Stack gap="sm">
            <EqualGrid columns={3} gap="xs">
              <Metric density="compact" label="Hull" value={<span className="numeric">{model.ship.hull}</span>} />
              <Metric density="compact" label="Cargo" value={<span className="numeric">{model.ship.cargo}</span>} />
              <Metric density="compact" label="Jump" value={<span className="numeric">{model.ship.jumpRange}</span>} />
            </EqualGrid>
          </Stack>
        </Widget>

        <Widget
          className="dashboard-route"
          detail={model.route.detail}
          eyebrow="Route"
          heading={model.route.destination.toUpperCase()}
          link={<RouteLink hrefFor={hrefFor} onNavigate={onNavigate} route={{ kind: 'information', section: 'galaxy', view: 'route' }}>View route</RouteLink>}
        >
          <Stack gap="sm">
            <DescriptionList className="dashboard-operational-list" columns="one" density="compact">
              <DescriptionItem label="Next jump" title={model.route.nextSystem} value={model.route.nextSystem} />
              <DescriptionItem label="Star class" value={model.route.nextStarClass} />
            </DescriptionList>
          </Stack>
        </Widget>
      </DashboardGrid>
    </PageFrame>
  )
}

function alignCommanderLogRows(body: HTMLDivElement): void {
  const list = body.querySelector<HTMLElement>(':scope > .item-list')
  if (!list) {
    body.scrollTop = body.scrollHeight
    return
  }

  const listTop = list.getBoundingClientRect().top
  const rowBounds = Array.from(list.children, row => {
    const bounds = row.getBoundingClientRect()
    return { start: bounds.top - listTop, end: bounds.bottom - listTop }
  })
  const tailSpace = bottomAlignedRowTailSpace(body.clientHeight, rowBounds)
  const value = `${tailSpace}px`
  if (list.style.getPropertyValue('--dashboard-log-tail-space') !== value) {
    list.style.setProperty('--dashboard-log-tail-space', value)
  }
  body.scrollTop = body.scrollHeight
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
