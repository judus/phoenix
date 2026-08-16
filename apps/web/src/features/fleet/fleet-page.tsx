import { useMemo, useState } from 'react'
import type { ShipDefinition } from '@phoenix/contracts'
import {
  AutoGrid,
  Breadcrumbs,
  CommandTile,
  ControlContext,
  DataTable,
  DataTableGroup,
  DescriptionItem,
  DescriptionList,
  Meter,
  PageFrame,
  PageHeader,
  Stack,
  Status,
  ViewSwitcher,
  Widget
} from '@phoenix/ui'
import type { InformationRoute, PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import type { RuntimeStateSnapshot } from '../../application/runtime/runtime-state-store.js'
import type { FleetControllerSnapshot, FleetView } from './use-fleet-controller.js'
import {
  createCurrentShipModel,
  createFleetOverviewModel,
  createStoredModulesModel,
  type CurrentShipModel
} from './fleet-view-model.js'
type FleetRoute = Extract<InformationRoute, { section: 'fleet' }>
type LoadoutView = 'list' | 'grid'
type CatalogueView = 'dossier' | 'table'

const currentRoutes = {
  'current-overview': { kind: 'information', section: 'fleet', view: 'current-overview' },
  'current-loadout': { kind: 'information', section: 'fleet', view: 'current-loadout' },
  'current-cargo': { kind: 'information', section: 'fleet', view: 'current-cargo' }
} as const satisfies Record<string, FleetRoute>

export function FleetPage({ controller, onExecuteAction, onNavigate, route, runtime }: {
  controller: FleetControllerSnapshot
  onExecuteAction?(actionId: string): void
  onNavigate(route: PhoenixRoute): void
  route: FleetRoute
  runtime: RuntimeStateSnapshot
}) {
  if (route.view.startsWith('current-')) {
    if (runtime.status !== 'ready') {
      return <FleetState title="Current ship" status={runtime.status} error={runtime.status === 'error' ? runtime.error : undefined} />
    }
    const model = createCurrentShipModel(runtime.state)
    if (route.view === 'current-loadout') return <CurrentLoadout model={model} />
    if (route.view === 'current-cargo') return <CurrentCargo model={model} />
    return <CurrentShipOverview
      actions={controller.actions}
      model={model}
      onExecuteAction={onExecuteAction}
      onNavigate={onNavigate}
    />
  }

  if (controller.status === 'loading' || controller.status === 'idle') return <FleetState title={titleFor(route.view)} status="loading" />
  if (controller.status === 'error') return <FleetState title={titleFor(route.view)} status="error" error={controller.error} />

  if (route.view === 'catalogue') {
    return <ShipCatalogue ships={controller.catalogue ?? []} route={route} onNavigate={onNavigate} />
  }
  if (!controller.fleet) return <FleetState title={titleFor(route.view)} status="error" error="Fleet records unavailable." />
  if (route.view === 'stored-modules') return <StoredModules fleet={controller.fleet} />
  if (route.view === 'carriers') return <FleetCarriers observed={controller.fleet.carriers.observed} />
  return <FleetOverview fleet={controller.fleet} />
}

function FleetState({ error, status, title }: { error?: string, status: 'idle' | 'loading' | 'error', title: string }) {
  return (
    <PageFrame className="fleet-state" layout="fit" aria-busy={status !== 'error'}>
      <PageHeader variant="cockpit" title={title} />
      <Status tone={status === 'error' ? 'danger' : 'muted'}>{error ?? `Loading ${title.toLowerCase()}…`}</Status>
    </PageFrame>
  )
}

function FleetOverview({ fleet }: { fleet: NonNullable<FleetControllerSnapshot['fleet']> }) {
  const model = createFleetOverviewModel(fleet)
  return (
    <PageFrame layout="fit">
      <div className="fleet-overview">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Fleet' }]} />}
          title="Fleet"
        />
        <dl className="fleet-summary">
          {model.summary.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}
        </dl>
        <DataTableGroup className="vessels" title="Owned vessels">
          <DataTable density="compact" label="Owned vessels" minimum="wide" narrow="priority" scheme="surface">
            <thead><tr><th>Vessel</th><th>State</th><th className="priority-secondary">Location</th><th className="numeric">Value</th><th className="priority-tertiary">Transfer</th><th className="priority-tertiary">Observed</th></tr></thead>
            <tbody>
              {model.ships.length === 0
                ? <tr><td colSpan={6} className="text-muted">No owned vessels have been observed.</td></tr>
                : model.ships.map(ship => (
                    <tr className={ship.active ? 'active' : undefined} key={ship.id}>
                      <td><strong>{ship.name}</strong><small>{ship.detail}</small></td>
                      <td>{ship.state}</td>
                      <td className="priority-secondary">{ship.location}</td>
                      <td className="numeric">{ship.value}</td>
                      <td className="priority-tertiary">{ship.transfer}</td>
                      <td className="priority-tertiary">{ship.observed}</td>
                    </tr>
                  ))}
            </tbody>
          </DataTable>
        </DataTableGroup>
        <dl className="asset-summary">
          {model.assets.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd><small>{item.detail}</small></div>)}
        </dl>
      </div>
    </PageFrame>
  )
}

function CurrentShipOverview({ actions, model, onExecuteAction, onNavigate }: {
  actions: FleetControllerSnapshot['actions']
  model: CurrentShipModel
  onExecuteAction?(actionId: string): void
  onNavigate(route: PhoenixRoute): void
}) {
  return (
    <PageFrame layout="fit">
      <div className="current-ship consolidated">
        <CurrentShipHeader model={model} />
        <div className="ship-grid">
          <div className="vessel-column">
            <FactsWidget title="Vessel" items={model.vessel} />
            <FactsWidget title="Operational status" items={model.operation} />
            <ControlContext className="command-grid" context="command" aria-label="Ship controls">
              {model.controls.map(control => {
                const action = actions?.actions.find(candidate => candidate.definition.id === control.actionId)
                const unavailable = action !== undefined && !action.available
                return (
                  <CommandTile
                    aria-label={`${control.label}: ${control.active ? 'active' : 'inactive'}`}
                    binding={action?.binding?.display}
                    key={control.actionId}
                    label={control.label}
                    onClick={() => onExecuteAction?.(control.actionId)}
                    selected={control.active}
                    unavailable={unavailable}
                  />
                )
              })}
            </ControlContext>
          </div>
          <div className="instrument-column">
            <MeterWidget title="Integrity" meters={model.integrity} />
            <MeterWidget title="Fuel" meters={model.fuel} />
            <Widget title="Cargo">
              <Stack className="cargo-content" gap="sm">
                <Meter
                  label="Capacity"
                  layout="inline"
                  max={model.cargo.capacity ?? Math.max(1, model.cargo.count)}
                  tone="action"
                  value={model.cargo.count}
                  valueLabel={`${model.cargo.count} / ${model.cargo.capacity ?? '—'} t`}
                />
                <DescriptionList aria-label="Cargo manifest" columns="one" density="compact" inset tabIndex={0}>
                  {model.cargo.items.length === 0
                    ? <DescriptionItem label="Manifest" value="Cargo hold is empty" />
                    : model.cargo.items.map(item => <DescriptionItem key={item.id} label={item.label} value={`${item.count} t`} />)}
                </DescriptionList>
              </Stack>
            </Widget>
            <div className="actions">
              <CommandTile details={false} label="Loadout" onClick={() => onNavigate(currentRoutes['current-loadout'])} />
              <CommandTile details={false} label="Engineering" onClick={() => onNavigate({ kind: 'information', section: 'engineering', view: 'blueprints' })} />
            </div>
          </div>
        </div>
      </div>
    </PageFrame>
  )
}

function CurrentLoadout({ model }: { model: CurrentShipModel }) {
  const [layout, setLayout] = useState<LoadoutView>('list')
  return (
    <PageFrame layout="fit">
      <div className="current-ship-loadout">
        <CurrentShipHeader
          actions={<ViewSwitcher startLabel="List" startIcon={<ListIcon />} endLabel="Grid" endIcon={<GridIcon />} position={layout === 'list' ? 'start' : 'end'} onPositionChange={position => setLayout(position === 'start' ? 'list' : 'grid')} />}
          current="Loadout"
          model={model}
        />
        <div className={`loadout-inventory ${layout}`} tabIndex={0}>
          {model.modules.length === 0
            ? <Status tone="muted">No loadout telemetry available.</Status>
            : model.modules.map(group => layout === 'list' ? <ModuleTable group={group} key={group.id} /> : <ModuleGrid group={group} key={group.id} />)}
        </div>
      </div>
    </PageFrame>
  )
}

function CurrentCargo({ model }: { model: CurrentShipModel }) {
  return (
    <PageFrame layout="fit">
      <div className="fleet-scroll-page current-cargo">
        <CurrentShipHeader current="Cargo" model={model} />
        <Stack className="fleet-scroll-content" gap="lg" tabIndex={0}>
          <Meter label="Cargo hold" max={model.cargo.capacity ?? Math.max(1, model.cargo.count)} tone="action" value={model.cargo.count} valueLabel={`${model.cargo.count} / ${model.cargo.capacity ?? '—'} t`} />
          <DataTableGroup title="Cargo manifest" meta={`${model.cargo.count} t`}>
            <DataTable density="compact" label="Current cargo manifest" narrow="priority" scheme="surface">
              <thead><tr><th>Commodity</th><th className="numeric">Quantity</th><th>Evidence</th></tr></thead>
              <tbody>
                {model.cargo.items.length === 0
                  ? <tr><td colSpan={3} className="text-muted">Cargo hold is empty.</td></tr>
                  : model.cargo.items.map(item => <tr key={item.id}><td><strong>{item.label}</strong><small>{item.id.split(':')[0]}</small></td><td className="numeric">{item.count} t</td><td>{item.detail}</td></tr>)}
              </tbody>
            </DataTable>
          </DataTableGroup>
        </Stack>
      </div>
    </PageFrame>
  )
}

function CurrentShipHeader({ actions, current, model }: {
  actions?: React.ReactNode
  current?: 'Loadout' | 'Cargo'
  model: CurrentShipModel
}) {
  const items = [
    { label: 'Fleet', href: '#/fleet/overview' },
    ...(current
      ? [{ label: 'Current ship', href: '#/fleet/ships/current/overview' }, { label: current }]
      : [{ label: 'Current ship' }])
  ]
  return (
    <PageHeader
      actions={actions}
      variant="cockpit"
      context={<Breadcrumbs items={items} />}
      title={model.title}
    />
  )
}

function FactsWidget({ items, title }: { items: CurrentShipModel['vessel'], title: string }) {
  return <Widget className="fixed-data" title={title}><DescriptionList className="adaptive-columns" columns="two" density="compact">{items.map(item => <DescriptionItem key={item.label} label={item.label} value={item.value} />)}</DescriptionList></Widget>
}

function MeterWidget({ meters, title }: { meters: CurrentShipModel['integrity'], title: string }) {
  return <Widget title={title}><Stack className="meter-stack" gap="lg">{meters.map(meter => <Meter key={meter.label} label={meter.label} layout="inline" tone="action" value={meter.value} valueLabel={meter.valueLabel} />)}</Stack></Widget>
}

function ModuleTable({ group }: { group: CurrentShipModel['modules'][number] }) {
  return (
    <DataTableGroup meta={`${group.mounted} / ${group.capacity} mounted`} title={group.label}>
      <DataTable density="compact" label={`${group.label} slots`} minimum="wide" scheme="surface">
        <thead className="sr-only"><tr><th>Slot</th><th>Module</th><th>Engineering</th><th>Condition</th></tr></thead>
        <tbody>{group.items.map(item => <ModuleRow item={item} key={item.id} />)}</tbody>
      </DataTable>
    </DataTableGroup>
  )
}

function ModuleRow({ item }: { item: CurrentShipModel['modules'][number]['items'][number] }) {
  return (
    <tr className={moduleClassName(item)}>
      <th scope="row"><strong>{item.slot}</strong><small>{item.slotDetail}</small></th>
      <td><strong>{item.module}</strong><small>{item.moduleDetail}</small></td>
      <td className={item.engineering !== 'Standard' ? 'text-information' : undefined}><strong>{item.engineering}</strong><small>{item.engineeringDetail}</small></td>
      <td className="numeric"><strong>{item.condition}</strong><small>{item.state}</small></td>
    </tr>
  )
}

function ModuleGrid({ group }: { group: CurrentShipModel['modules'][number] }) {
  return (
    <section><header><h2>{group.label}</h2><small>{group.mounted} / {group.capacity} mounted</small></header><ol>
      {group.items.map(item => <li className={moduleClassName(item)} data-slot-size={item.slotDetail.replace('Size ', 'S')} key={item.id}><header><strong>{item.slot}</strong><small>{item.slotDetail}</small></header><div><strong>{item.module}</strong><small>{item.moduleDetail}</small></div><div><span>{item.engineering}</span><small>{item.engineeringDetail}</small></div><footer><strong>{item.condition}</strong><small>{item.state}</small></footer></li>)}
    </ol></section>
  )
}

function moduleClassName(item: CurrentShipModel['modules'][number]['items'][number]): string | undefined {
  return [
    item.empty && 'empty',
    item.engineering !== 'Standard' && (item.engineering.endsWith('G5') ? 'engineered-max' : 'engineered'),
    item.status
  ].filter(Boolean).join(' ') || undefined
}

function StoredModules({ fleet }: { fleet: NonNullable<FleetControllerSnapshot['fleet']> }) {
  const model = createStoredModulesModel(fleet)
  return (
    <PageFrame layout="fit"><div className="stored-modules">
      <PageHeader
        variant="cockpit"
        context={<Breadcrumbs items={[{ label: 'Fleet', href: '#/fleet/overview' }, { label: 'Stored modules' }]} />}
        status={`${model.details} · ${model.authority}`}
        title="Stored modules"
      />
      <div className="module-groups" tabIndex={0}>
        {model.groups.length === 0 ? <Status tone="muted">No stored modules were present in the latest snapshot.</Status> : model.groups.map(group => (
          <DataTableGroup className="module-storage" meta={`${group.items.length} modules`} title={group.system} key={group.system}>
            <DataTable density="compact" label={`Modules stored at ${group.system}`} narrow="priority" scheme="surface"><thead><tr><th>Module</th><th>Engineering</th><th className="numeric">Storage slot</th><th>Transfer</th><th className="numeric">Purchase value</th><th>Observed</th></tr></thead><tbody>{group.items.map(item => <tr key={item.key}><td><strong>{item.name}</strong><small>{item.identifier}</small></td><td className={item.engineering !== '—' ? 'text-information' : undefined}>{item.engineering}</td><td className="numeric">{item.slot}</td><td>{item.transfer}</td><td className="numeric">{item.value}</td><td>{item.observed}</td></tr>)}</tbody></DataTable>
          </DataTableGroup>
        ))}
      </div>
    </div></PageFrame>
  )
}

function FleetCarriers({ observed }: { observed: boolean }) {
  return (
    <PageFrame layout="fit"><div className="fleet-scroll-page"><PageHeader variant="cockpit" context={<Breadcrumbs items={[{ label: 'Fleet', href: '#/fleet/overview' }, { label: 'Carriers' }]} />} title="Fleet carriers" /><Stack className="fleet-scroll-content" gap="lg"><Widget title="Carrier authority"><Status tone={observed ? 'information' : 'muted'}>{observed ? 'Carrier records observed locally.' : 'No authoritative carrier record observed.'}</Status><p>Zero observed carriers means unknown or none observed—not a claim that the commander owns no carrier.</p></Widget></Stack></div></PageFrame>
  )
}

function ShipCatalogue({ onNavigate, route, ships }: { onNavigate(route: PhoenixRoute): void, route: Extract<FleetRoute, { view: 'catalogue' }>, ships: readonly ShipDefinition[] }) {
  const sorted = useMemo(() => [...ships].sort((left, right) => left.displayName.localeCompare(right.displayName)), [ships])
  const selected = sorted.find(ship => ship.id === route.selectedShipId) ?? sorted[0]
  const [view, setView] = useState<CatalogueView>('dossier')
  const select = (ship: ShipDefinition) => onNavigate({ kind: 'information', section: 'fleet', view: 'catalogue', selectedShipId: ship.id })
  return (
    <PageFrame layout="fit"><div className="ship-catalogue schematic">
      <PageHeader actions={<ViewSwitcher startLabel="Dossier" startIcon={<DossierIcon />} endLabel="Table" endIcon={<GridIcon />} position={view === 'dossier' ? 'start' : 'end'} onPositionChange={position => setView(position === 'start' ? 'dossier' : 'table')} />} variant="cockpit" context={<Breadcrumbs items={[{ label: 'Fleet', href: '#/fleet/overview' }, { label: 'Ship catalogue' }]} />} status={selected ? `Source: ${selected.source.name}${selected.source.revision ? ` · ${selected.source.revision}` : ''}` : undefined} title="Ship catalogue" />
      {sorted.length === 0 ? <Status tone="muted">No ship catalogue records are available.</Status> : view === 'dossier' ? <div className="catalogue-deck"><HullRoster current={selected?.id} ships={sorted} onSelect={select} />{selected && <HullSchematic ship={selected} />}</div> : <CatalogueTable current={selected?.id} ships={sorted} onSelect={ship => { select(ship); setView('dossier') }} />}
    </div></PageFrame>
  )
}

function HullRoster({ current, onSelect, ships }: { current?: string, onSelect(ship: ShipDefinition): void, ships: readonly ShipDefinition[] }) {
  return <section className="hull-roster"><DataTable density="compact" label="Known ship hulls" narrow="priority"><tbody>{ships.map(ship => <tr className={ship.id === current ? 'active' : undefined} aria-selected={ship.id === current} tabIndex={0} key={ship.id} onClick={() => onSelect(ship)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(ship) } }}><td><strong>{ship.displayName}</strong><small>{ship.manufacturer ?? 'Unknown manufacturer'}</small></td></tr>)}</tbody></DataTable></section>
}

function HullSchematic({ ship }: { ship: ShipDefinition }) {
  const slotCount = Object.values(ship.slots).reduce((count, slots) => count + slots.length, 0)
  return <article className="hull-schematic"><header><div><h2>{ship.displayName}</h2><p>{ship.manufacturer ?? 'Unknown manufacturer'}</p></div><span>{ship.landingPadSize ?? 'unknown'} pad</span></header><dl className="flight-profile"><Profile label="Armour" value={ship.performance.baseArmour} /><Profile label="Shield" value={ship.performance.baseShieldStrength} /><Profile label="Speed" value={ship.performance.speed} suffix=" m/s" /><Profile label="Boost" value={ship.performance.boost} suffix=" m/s" /><Profile label="Mass" value={ship.performance.hullMass} suffix=" t" /><Profile label="Frontier ID" value={ship.identifiers.frontierEdId} /></dl><section className="capacity-matrix"><header><h3>Frame capacity</h3><small>{slotCount} positions</small></header><div><CapacityRow label="Core" slots={ship.slots.core} /><CapacityRow label="Optional" slots={ship.slots.optional} /><CapacityRow label="Hardpoints" slots={ship.slots.hardpoints} /><CapacityRow label="Utility" slots={ship.slots.utilities} /></div></section></article>
}

function Profile({ label, suffix = '', value }: { label: string, suffix?: string, value: number | null }) { return <div><dt>{label}</dt><dd>{value === null ? '—' : `${value.toLocaleString()}${suffix}`}</dd></div> }
function CapacityRow({ label, slots }: { label: string, slots: Array<{ size: number }> }) { return <section><header><h4>{label}</h4><small>{slots.length}</small></header><ol>{slots.map((slot, index) => <li key={`${label}-${index}`}>S{slot.size}</li>)}</ol></section> }
function CatalogueTable({ current, onSelect, ships }: { current?: string, onSelect(ship: ShipDefinition): void, ships: readonly ShipDefinition[] }) { return <div className="catalogue-table-view"><DataTable density="compact" label="Known ship hulls" minimum="wide" scheme="information" stickyHeader><thead><tr><th>Hull</th><th>Manufacturer</th><th>Pad</th><th className="numeric">Armour</th><th className="numeric">Shield</th><th className="numeric">Speed</th><th className="numeric">Boost</th><th className="numeric">Mass</th></tr></thead><tbody>{ships.map(ship => <tr className={ship.id === current ? 'active' : undefined} aria-selected={ship.id === current} tabIndex={0} key={ship.id} onClick={() => onSelect(ship)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(ship) } }}><th scope="row">{ship.displayName}</th><td>{ship.manufacturer ?? '—'}</td><td>{ship.landingPadSize ?? '—'}</td><td className="numeric">{ship.performance.baseArmour ?? '—'}</td><td className="numeric">{ship.performance.baseShieldStrength ?? '—'}</td><td className="numeric">{ship.performance.speed ?? '—'}</td><td className="numeric">{ship.performance.boost ?? '—'}</td><td className="numeric">{ship.performance.hullMass ?? '—'}</td></tr>)}</tbody></DataTable></div> }

function titleFor(view: FleetView): string {
  if (view === 'overview') return 'Fleet'
  if (view === 'stored-modules') return 'Stored modules'
  if (view === 'catalogue') return 'Ship catalogue'
  if (view === 'carriers') return 'Fleet carriers'
  return 'Current ship'
}

function ListIcon() { return <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M2 3.5h12M2 8h12M2 12.5h12" /></svg> }
function GridIcon() { return <svg aria-hidden="true" viewBox="0 0 16 16"><rect x="2" y="2" width="4" height="4" /><rect x="10" y="2" width="4" height="4" /><rect x="2" y="10" width="4" height="4" /><rect x="10" y="10" width="4" height="4" /></svg> }
function DossierIcon() { return <svg aria-hidden="true" viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" /><path d="M4 5h8M4 8h3M8 8h4M4 11h5M10 11h2" /></svg> }
