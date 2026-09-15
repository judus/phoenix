import type { GameActionCatalogResponse } from '@phoenix/contracts'
import type { ReactNode } from 'react'
import {
  CommandTile,
  ControlContext,
  DescriptionItem,
  DescriptionList,
  ItemList,
  ItemListItem,
  Meter,
  PageFrame,
  Status,
  TileButton,
  Widget,
} from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'
import type { CurrentShipModel } from './fleet-view-model.js'

const shipRoutes = {
  cargo: { kind: 'information', section: 'fleet', view: 'current-cargo' },
  engineering: { kind: 'information', section: 'fleet', view: 'current-engineering' },
  loadout: { kind: 'information', section: 'fleet', view: 'current-loadout' }
} as const satisfies Record<string, PhoenixRoute>

const moduleStatusCommandOrder = [
  'elite.ToggleCargoScoop',
  'elite.LandingGearToggle'
]

const primaryShipCommandOrder = [
  'elite.GalaxyMapOpen',
  'elite.TargetNextRouteSystem',
  'elite.SilentRunning',
  'elite.SystemMapOpen',
  'elite.OrbitLinesToggle',
  'elite.ShipSpotLightToggle',
  'elite.NightVisionToggle'
]

export function CurrentShipOverview({ actions, model, onExecuteAction, onNavigate }: {
  actions: GameActionCatalogResponse | undefined
  model: CurrentShipModel
  onExecuteAction?(actionId: string): void
  onNavigate(route: PhoenixRoute): void
}) {
  const primaryControls = primaryShipCommandOrder
    .map(actionId => model.controls.find(control => control.actionId === actionId))
    .filter(control => control !== undefined)
  const moduleStatusControls = moduleStatusCommandOrder
    .map(actionId => model.controls.find(control => control.actionId === actionId))
    .filter(control => control !== undefined)

  return (
    <PageFrame layout="fit">
      <div className="current-ship consolidated">
        <div className="ship-grid">
          <div className="ship-upper-grid">
            <div className="vessel-column">
              <ControlContext className="command-grid" context="command" aria-label="Ship commands">
                {primaryControls.slice(0, 2).map(control => (
                  <ActionCommand
                    actionId={control.actionId}
                    actions={actions}
                    active={control.active}
                    key={control.actionId}
                    label={control.label}
                    onExecuteAction={onExecuteAction}
                  />
                ))}
                <TileButton
                  aria-label="Request docking unavailable"
                  className="compact"
                  disabled
                  label="Dock"
                  note="N/A"
                  title="Docking request is not available yet."
                  type="button"
                />
                {primaryControls.slice(2).map(control => (
                  <ActionCommand
                    actionId={control.actionId}
                    actions={actions}
                    active={control.active}
                    key={control.actionId}
                    label={control.label}
                    onExecuteAction={onExecuteAction}
                  />
                ))}
              </ControlContext>
              <FactsWidget
                items={[...model.vessel, ...model.operation]}
                label="Current Vessel"
                link={<CurrentShipLinks onNavigate={onNavigate} />}
              />
            </div>

            <div className="instrument-column">
              <WarningsWidget warnings={model.warnings} />
              <MeterWidget label="Integrity & Fuel" meters={[...model.integrity, ...model.fuel]} />
              <PowerDistributionWidget actions={actions} model={model} onExecuteAction={onExecuteAction} />
            </div>
          </div>

          <div className="ship-lower-grid">
            <ControlContext className="module-status-controls" context="command" aria-label="Module status ship commands">
              {moduleStatusControls.map(control => (
                <ActionCommand
                  actionId={control.actionId}
                  actions={actions}
                  active={control.active}
                  key={control.actionId}
                  label={control.label}
                  onExecuteAction={onExecuteAction}
                />
              ))}
            </ControlContext>
            <CargoWidget model={model} onNavigate={onNavigate} />
            <ModuleStatusWidget model={model} onNavigate={onNavigate} />
          </div>
        </div>
      </div>
    </PageFrame>
  )
}

function FactsWidget({ items, label, link }: {
  items: CurrentShipModel['vessel']
  label: string
  link?: ReactNode
}) {
  return (
    <Widget aria-label={label} className="fixed-data" eyebrow={label} link={link}>
      <DescriptionList className="adaptive-columns" columns="two" density="compact">
        {items.map(item => <DescriptionItem key={item.label} label={item.label} value={item.value} />)}
      </DescriptionList>
    </Widget>
  )
}

function MeterWidget({ meters, label }: { meters: CurrentShipModel['integrity'], label: string }) {
  return (
    <Widget aria-label={label} className="widget-eyebrow-hidden" eyebrow={label}>
      <div className="meter-stack">
        {meters.map(meter => <Meter key={meter.label} label={meter.label} layout="inline" tone="action" value={meter.value} valueLabel={meter.valueLabel} />)}
      </div>
    </Widget>
  )
}

function CargoWidget({ model, onNavigate }: { model: CurrentShipModel, onNavigate(route: PhoenixRoute): void }) {
  return (
    <Widget
      aria-label="Cargo"
      autoHideScrollbar
      className="cargo-widget"
      eyebrow="Cargo"
      link={<RouteLink label="View cargo" onNavigate={onNavigate} route={shipRoutes.cargo} />}
      scrollable
    >
      <div className="cargo-content">
        <Meter
          label="Capacity"
          layout="inline"
          max={model.cargo.capacity ?? Math.max(1, model.cargo.count)}
          tone="action"
          value={model.cargo.count}
          valueLabel={`${model.cargo.count}/${model.cargo.capacity ?? '—'} t`}
        />
        <ItemList aria-label="Cargo manifest" density="compact">
          {model.cargo.items.length === 0
            ? <ItemListItem title="Cargo hold is empty" />
            : model.cargo.items.map(item => <ItemListItem key={item.id} title={item.label} trailing={`${item.count} t`} />)}
        </ItemList>
      </div>
    </Widget>
  )
}

function PowerDistributionWidget({ actions, model, onExecuteAction }: {
  actions: GameActionCatalogResponse | undefined
  model: CurrentShipModel
  onExecuteAction?(actionId: string): void
}) {
  return (
    <>
      <Widget aria-label="Power distribution" className="power-distribution-widget widget-eyebrow-hidden" eyebrow="Power distribution">
        <div className="pip-readouts">
          {model.powerDistribution.channels.map(channel => (
            <div className="pip-readout" key={channel.actionId}>
              <span>{channel.label}</span>
              <div
                aria-label={`${channel.label}: ${channel.value ?? 'not reported'} of 8`}
                aria-valuemax={8}
                aria-valuemin={0}
                aria-valuenow={channel.value ?? undefined}
                className="pip-segments"
                role="meter"
              >
                {Array.from({ length: 8 }, (_, index) => <span className={channel.value !== null && index < channel.value ? 'active' : undefined} key={index} />)}
              </div>
            </div>
          ))}
        </div>
      </Widget>
      <ControlContext className="pip-controls" context="command" aria-label="Power distribution controls">
        {model.powerDistribution.channels.map(channel => (
          <ActionCommand
            actionId={channel.actionId}
            actions={actions}
            active={false}
            hideBinding
            key={channel.actionId}
            label={channel.shortLabel}
            onExecuteAction={onExecuteAction}
          />
        ))}
        <ActionCommand
          actionId={model.powerDistribution.resetActionId}
          actions={actions}
          active={false}
          hideBinding
          label="RST"
          onExecuteAction={onExecuteAction}
        />
      </ControlContext>
    </>
  )
}

function WarningsWidget({ warnings }: { warnings: CurrentShipModel['warnings'] }) {
  return (
    <Widget aria-label="Warnings" className="widget-eyebrow-hidden" eyebrow="Warnings">
      <div className="warning-lamps">
        {warnings.map(warning => (
          <div className="warning-lamp" data-active={warning.active || undefined} data-tone={warning.tone} key={warning.id}>
            <span aria-hidden="true" />
            <strong>{warning.label}</strong>
          </div>
        ))}
      </div>
    </Widget>
  )
}

function ModuleStatusWidget({ model, onNavigate }: { model: CurrentShipModel, onNavigate(route: PhoenixRoute): void }) {
  const { moduleStatus } = model
  return (
    <Widget
      aria-label="Module power and health"
      autoHideScrollbar
      className="module-status-widget"
      eyebrow="Module power and health"
      link={<RouteLink label="Loadout" onNavigate={onNavigate} route={shipRoutes.loadout} />}
      scrollable
    >
      <DescriptionList columns="two" density="compact">
        <DescriptionItem label={`Health ≤ ${moduleStatus.healthAlertThreshold}%`} value={String(moduleStatus.damaged.length)} />
        <DescriptionItem label="Disabled" value={String(moduleStatus.disabled.length)} />
      </DescriptionList>
      {moduleStatus.damaged.length === 0 && moduleStatus.disabled.length === 0
        ? <Status tone="muted">All reported modules nominal.</Status>
        : <ItemList aria-label="Module power and health alerts" density="dense">
            {moduleStatus.damaged.map(module => (
              <ItemListItem
                key={`damaged:${module.id}`}
                title={module.label}
                trailing={`${module.condition} ${priorityLabel(module.priority)}`}
              />
            ))}
            {moduleStatus.disabled.map(module => (
              <ItemListItem
                key={`disabled:${module.id}`}
                title={module.label}
                trailing={`Disabled ${priorityLabel(module.priority)}`}
              />
            ))}
          </ItemList>}
    </Widget>
  )
}

function ActionCommand({ actionId, actions, active, details = true, hideBinding = false, label, onExecuteAction }: {
  actionId: string
  actions: GameActionCatalogResponse | undefined
  active: boolean
  details?: boolean
  hideBinding?: boolean
  label: string
  onExecuteAction?(actionId: string): void
}) {
  const action = actions?.actions.find(candidate => candidate.definition.id === actionId)
  return (
    <CommandTile
      aria-label={`${label}: ${active ? 'active' : 'inactive'}`}
      binding={action?.binding?.display}
      compact
      details={details}
      hideBinding={hideBinding}
      label={label}
      onClick={() => onExecuteAction?.(actionId)}
      selected={active}
      unavailable={action !== undefined && !action.available}
    />
  )
}

function RouteLink({ label, onNavigate, route }: { label: string, onNavigate(route: PhoenixRoute): void, route: PhoenixRoute }) {
  return (
    <a
      href={phoenixRouteHash(route)}
      onClick={event => {
        event.preventDefault()
        onNavigate(route)
      }}
    >
      {label}
    </a>
  )
}

function CurrentShipLinks({ onNavigate }: { onNavigate(route: PhoenixRoute): void }) {
  return (
    <span className="current-ship-links">
      <RouteLink label="Engineering" onNavigate={onNavigate} route={shipRoutes.engineering} />
    </span>
  )
}

function priorityLabel(priority: number | null): string {
  return priority === null ? 'P—' : `P${priority}`
}
