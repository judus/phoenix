import { useMemo, useSyncExternalStore } from 'react'
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
  MetricStrip,
  MetricStripItem,
  PageFrame,
  PageHeader,
  SortableDataTable,
  Stack,
  Status,
  ViewSwitcher,
  Widget,
  type SortableDataTableColumn
} from '@phoenix/ui'
import type { InformationRoute, PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import type { RuntimeStateSnapshot } from '../../application/runtime/runtime-state-store.js'
import type { DevicePreferences } from '../../application/settings/device-preferences.js'
import { DataSyncNotice } from '../../components/data-sync-notice.js'
import { SystemLocationLink } from '../../components/system-location-link.js'
import { UpdatedDateTime } from '../../components/phoenix-date-time.js'
import type { FleetControllerSnapshot, FleetView } from './use-fleet-controller.js'
import {
  createCurrentShipModel,
  createFleetOverviewModel,
  createStoredModulesModel,
  type CurrentShipModel,
  type FleetOverviewModel
} from './fleet-view-model.js'
type FleetRoute = Extract<InformationRoute, { section: 'fleet' }>
const currentRoutes = {
  'current-overview': { kind: 'information', section: 'fleet', view: 'current-overview' },
  'current-loadout': { kind: 'information', section: 'fleet', view: 'current-loadout' },
  'current-cargo': { kind: 'information', section: 'fleet', view: 'current-cargo' },
  'current-engineering': { kind: 'information', section: 'fleet', view: 'current-engineering' }
} as const satisfies Record<string, FleetRoute>

export function FleetPage({ controller, devicePreferences, onExecuteAction, onNavigate, route, runtime }: {
  controller: FleetControllerSnapshot
  devicePreferences: DevicePreferences
  onExecuteAction?(actionId: string): void
  onNavigate(route: PhoenixRoute): void
  route: FleetRoute
  runtime: RuntimeStateSnapshot
}) {
  const preferences = useSyncExternalStore(
    devicePreferences.subscribe,
    devicePreferences.getSnapshot,
    devicePreferences.getSnapshot
  )

  if (route.view.startsWith('current-')) {
    if (runtime.status !== 'ready') {
      return <FleetState title="Current ship" status={runtime.status} error={runtime.status === 'error' ? runtime.error : undefined} />
    }
    const model = createCurrentShipModel(runtime.state)
    if (route.view === 'current-loadout') return <CurrentLoadout
      layout={preferences.currentShipLoadoutView}
      model={model}
      onLayoutChange={layout => devicePreferences.update({ currentShipLoadoutView: layout })}
    />
    if (route.view === 'current-cargo') return <CurrentCargo model={model} />
    if (route.view === 'current-engineering') return <CurrentEngineering model={model} />
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
    return <ShipCatalogue
      updatedAt={controller.catalogueUpdatedAt}
      ships={controller.catalogue ?? []}
      route={route}
      view={preferences.shipCatalogueView}
      onNavigate={onNavigate}
      onViewChange={view => devicePreferences.update({ shipCatalogueView: view })}
    />
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
  const hasNotices = fleet.shipsSnapshotAt === null || fleet.summary.unknown > 0
  return (
    <PageFrame layout="fit">
      <div className={`fleet-overview${hasNotices ? ' has-notices' : ''}`}>
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Fleet' }]} />}
          status={model.updatedAt ? <UpdatedDateTime value={model.updatedAt} /> : undefined}
          title="Fleet"
        />
        <MetricStrip columns={4}>
          {model.summary.map(item => <MetricStripItem key={item.label} label={item.label} value={item.value} />)}
        </MetricStrip>
        {hasNotices
          ? <div className="fleet-notices">
              {fleet.shipsSnapshotAt === null
                ? <DataSyncNotice>Stored fleet not synchronized. Open Starport Services → Shipyard in Elite to publish the vessel manifest.</DataSyncNotice>
                : null}
              {fleet.summary.unknown > 0
                ? <DataSyncNotice>{`${fleet.summary.unknown} vessel ${fleet.summary.unknown === 1 ? 'record is' : 'records are'} unresolved. Open Starport Services → Shipyard in Elite to refresh the fleet manifest.`}</DataSyncNotice>
                : null}
            </div>
          : null}
        <DataTableGroup className="vessels" title="Owned vessels">
          <SortableDataTable
            columns={FLEET_COLUMNS}
            density="compact"
            empty={<span className="text-muted">No owned vessels have been observed.</span>}
            label="Owned vessels"
            minimum="wide"
            narrow="priority"
            rowKey={ship => ship.id}
            rowProps={ship => ({ className: ship.active ? 'active' : undefined })}
            rows={model.ships}
            scheme="surface"
          />
        </DataTableGroup>
      </div>
    </PageFrame>
  )
}

type FleetShipModel = FleetOverviewModel['ships'][number]

const FLEET_COLUMNS: readonly SortableDataTableColumn<FleetShipModel>[] = [
  {
    cell: ship => <><strong>{ship.name}</strong><small>{ship.detail}</small></>,
    className: 'vessel-column',
    heading: 'Vessel',
    id: 'vessel',
    rowHeader: true,
    sortValue: ship => ship.name
  },
  {
    cell: ship => <SystemLocationLink locationName={ship.location.locationName} systemName={ship.location.systemName} />,
    className: 'priority-secondary',
    heading: 'Location',
    id: 'location',
    sortValue: ship => [ship.location.systemName, ship.location.locationName].filter(Boolean).join(' ')
  },
  {
    cell: ship => ship.value,
    className: 'numeric',
    heading: 'Value',
    id: 'value',
    sortValue: ship => ship.valueAmount
  },
  {
    cell: ship => ship.transferTime,
    className: 'numeric priority-tertiary',
    heading: 'Transfer time',
    id: 'transfer-time',
    sortValue: ship => ship.transferSeconds
  },
  {
    cell: ship => ship.transferCost,
    className: 'numeric priority-tertiary',
    heading: 'Transfer cost',
    id: 'transfer-cost',
    sortValue: ship => ship.transferPrice
  }
]

function CurrentShipOverview({ actions, model, onExecuteAction, onNavigate }: {
  actions: FleetControllerSnapshot['actions']
  model: CurrentShipModel
  onExecuteAction?(actionId: string): void
  onNavigate(route: PhoenixRoute): void
}) {
  return (
    <PageFrame layout="fit">
      <div className="current-ship consolidated">
        <div className="ship-grid">
          <div className="vessel-column">
            <FactsWidget label="Current Vessel" items={model.vessel} />
            <FactsWidget label="Operational status" items={model.operation} />
            <ControlContext className="command-grid" context="command" aria-label="Ship controls">
              {model.controls.map(control => {
                const action = actions?.actions.find(candidate => candidate.definition.id === control.actionId)
                const unavailable = action !== undefined && !action.available
                return (
                  <CommandTile
                    aria-label={`${control.label}: ${control.active ? 'active' : 'inactive'}`}
                    binding={action?.binding?.display}
                    compact
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
            <MeterWidget label="Integrity" meters={model.integrity} />
            <MeterWidget label="Fuel" meters={model.fuel} />
            <Widget aria-label="Cargo" eyebrow="Cargo">
              <div className="cargo-content">
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
              </div>
            </Widget>
            <div className="actions">
              <CommandTile compact details={false} label="Loadout" onClick={() => onNavigate(currentRoutes['current-loadout'])} />
              <CommandTile compact details={false} label="Engineering" onClick={() => onNavigate(currentRoutes['current-engineering'])} />
            </div>
          </div>
        </div>
      </div>
    </PageFrame>
  )
}

function CurrentLoadout({ layout, model, onLayoutChange }: {
  layout: 'table' | 'tiles'
  model: CurrentShipModel
  onLayoutChange(layout: 'table' | 'tiles'): void
}) {
  return (
    <PageFrame layout="fit">
      <div className="current-ship-loadout">
        <CurrentShipHeader
          actions={<ViewSwitcher startLabel="Table" startIcon={<TableIcon />} endLabel="Tiles" endIcon={<TilesIcon />} position={layout === 'table' ? 'start' : 'end'} onPositionChange={position => onLayoutChange(position === 'start' ? 'table' : 'tiles')} />}
          current="Loadout"
          model={model}
        />
        <div className={`loadout-inventory ${layout === 'table' ? 'list' : 'grid'}`} tabIndex={0}>
          {model.modules.length === 0
            ? <Status tone="muted">No loadout telemetry available.</Status>
            : model.modules.map(group => layout === 'table' ? <ModuleTable group={group} key={group.id} /> : <ModuleGrid group={group} key={group.id} />)}
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

function CurrentEngineering({ model }: { model: CurrentShipModel }) {
  const modules = model.modules.flatMap(group => group.items).filter(item => item.engineering !== 'Standard')
  return (
    <PageFrame layout="fit">
      <div className="fleet-scroll-page current-engineering">
        <CurrentShipHeader current="Engineering" model={model} />
        <Stack className="fleet-scroll-content" gap="lg" tabIndex={0}>
          <DataTableGroup meta={`${modules.length} engineered`} title="Applied blueprints">
            <DataTable density="compact" label="Engineering applied to the current ship" minimum="wide" narrow="priority" scheme="surface">
              <thead><tr><th>Module</th><th>Blueprint</th><th>Grade</th><th>Engineer</th><th>Experimental effect</th><th>Condition</th></tr></thead>
              <tbody>{modules.length === 0
                ? <tr><td className="text-muted" colSpan={6}>No engineered modules observed on the current ship.</td></tr>
                : modules.map(item => (
                    <tr className={moduleClassName(item)} key={item.id}>
                      <td><strong>{item.module}</strong><small>{item.slot} · {item.slotDetail}</small></td>
                      <td>{item.engineeringBlueprint ?? '—'}</td>
                      <td>{item.engineeringGrade === null ? '—' : `G${item.engineeringGrade}`}</td>
                      <td>{item.engineeringEngineer ?? '—'}</td>
                      <td>{item.engineeringExperimentalEffect ?? '—'}</td>
                      <td className="numeric"><strong>{item.condition}</strong><small>{item.state}</small></td>
                    </tr>
                  ))}</tbody>
            </DataTable>
          </DataTableGroup>
        </Stack>
      </div>
    </PageFrame>
  )
}

function CurrentShipHeader({ actions, current, model }: {
  actions?: React.ReactNode
  current?: 'Loadout' | 'Cargo' | 'Engineering'
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

function FactsWidget({ items, label }: { items: CurrentShipModel['vessel'], label: string }) {
  return <Widget aria-label={label} className="fixed-data" eyebrow={label}><DescriptionList className="adaptive-columns" columns="two" density="compact">{items.map(item => <DescriptionItem key={item.label} label={item.label} value={item.value} />)}</DescriptionList></Widget>
}

function MeterWidget({ meters, label }: { meters: CurrentShipModel['integrity'], label: string }) {
  return <Widget aria-label={label} eyebrow={label}><div className="meter-stack">{meters.map(meter => <Meter key={meter.label} label={meter.label} layout="inline" tone="action" value={meter.value} valueLabel={meter.valueLabel} />)}</div></Widget>
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
      <div className="module-manifest">
        {fleet.storedModules.snapshotAt === null
          ? <DataSyncNotice>Stored modules not synchronized. Open Starport Services → Outfitting in Elite to publish the module manifest.</DataSyncNotice>
          : model.items.length === 0
            ? <Status tone="muted">No stored modules were present in the latest snapshot.</Status>
            : <DataTableGroup className="module-storage fill" meta={model.meta} title="Module manifest">
                <DataTable density="compact" label="Stored module manifest" minimum="wide" narrow="priority" scheme="surface" stickyHeader>
                  <thead><tr><th>Module</th><th className="priority-secondary">Engineering</th><th>Location</th><th>Transfer</th><th className="numeric priority-tertiary">Purchase value</th></tr></thead>
                  <tbody>{model.items.map(item => <tr key={item.key}><td><strong>{item.name}</strong><small>{item.identifier}</small></td><td className={`priority-secondary${item.engineering !== '—' ? ' text-information' : ''}`}>{item.engineering}</td><td><SystemLocationLink locationName={item.location.locationName} systemName={item.location.systemName} /></td><td className="data-value">{item.transfer}</td><td className="numeric priority-tertiary">{item.value}</td></tr>)}</tbody>
                </DataTable>
              </DataTableGroup>}
      </div>
    </div></PageFrame>
  )
}

function FleetCarriers({ observed }: { observed: boolean }) {
  return (
    <PageFrame layout="fit"><div className="fleet-scroll-page"><PageHeader variant="cockpit" context={<Breadcrumbs items={[{ label: 'Fleet', href: '#/fleet/overview' }, { label: 'Carriers' }]} />} title="Fleet carriers" /><Stack className="fleet-scroll-content" gap="lg"><Widget heading="Carrier authority"><Status tone={observed ? 'information' : 'muted'}>{observed ? 'Carrier records observed locally.' : 'No authoritative carrier record observed.'}</Status><p>Zero observed carriers means unknown or none observed—not a claim that the commander owns no carrier.</p></Widget></Stack></div></PageFrame>
  )
}

function ShipCatalogue({ onNavigate, onViewChange, route, ships, updatedAt, view }: {
  onNavigate(route: PhoenixRoute): void
  onViewChange(view: 'dossier' | 'table'): void
  route: Extract<FleetRoute, { view: 'catalogue' }>
  ships: readonly ShipDefinition[]
  updatedAt?: string
  view: 'dossier' | 'table'
}) {
  const sorted = useMemo(() => [...ships].sort((left, right) => left.displayName.localeCompare(right.displayName)), [ships])
  const selected = sorted.find(ship => ship.id === route.selectedShipId) ?? sorted[0]
  const select = (ship: ShipDefinition) => onNavigate({ kind: 'information', section: 'fleet', view: 'catalogue', selectedShipId: ship.id })
  return (
    <PageFrame layout="fit"><div className="ship-catalogue schematic">
      <PageHeader actions={<ViewSwitcher startLabel="Dossier" startIcon={<DossierIcon />} endLabel="Table" endIcon={<TableIcon />} position={view === 'dossier' ? 'start' : 'end'} onPositionChange={position => onViewChange(position === 'start' ? 'dossier' : 'table')} />} variant="cockpit" context={<Breadcrumbs items={[{ label: 'Fleet', href: '#/fleet/overview' }, { label: 'Ship catalogue' }]} />} status={updatedAt ? <UpdatedDateTime value={updatedAt} /> : undefined} title="Ship catalogue" />
      {sorted.length === 0 ? <Status tone="muted">No ship catalogue records are available.</Status> : view === 'dossier' ? <div className="catalogue-deck"><HullRoster current={selected?.id} ships={sorted} onSelect={select} />{selected && <HullSchematic ship={selected} />}</div> : <CatalogueTable current={selected?.id} ships={sorted} onSelect={ship => { select(ship); onViewChange('dossier') }} />}
    </div></PageFrame>
  )
}

function HullRoster({ current, onSelect, ships }: { current?: string, onSelect(ship: ShipDefinition): void, ships: readonly ShipDefinition[] }) {
  return <section className="hull-roster"><DataTable density="compact" label="Known ship hulls" narrow="priority" scheme="surface"><tbody>{ships.map(ship => <tr className={ship.id === current ? 'active' : undefined} aria-selected={ship.id === current} tabIndex={0} key={ship.id} onClick={() => onSelect(ship)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(ship) } }}><th scope="row"><strong>{ship.displayName}</strong><small>{ship.manufacturer ?? 'Unknown manufacturer'}</small></th></tr>)}</tbody></DataTable></section>
}

function HullSchematic({ ship }: { ship: ShipDefinition }) {
  const slotCount = Object.values(ship.slots).reduce((count, slots) => count + slots.length, 0)
  return <article className="hull-schematic"><header><div><h2>{ship.displayName}</h2><p>{ship.manufacturer ?? 'Unknown manufacturer'}</p></div><span>{ship.landingPadSize ?? 'unknown'} pad</span></header><dl className="flight-profile"><Profile label="Armour" value={ship.performance.baseArmour} /><Profile label="Shield" value={ship.performance.baseShieldStrength} /><Profile label="Speed" value={ship.performance.speed} suffix=" m/s" /><Profile label="Boost" value={ship.performance.boost} suffix=" m/s" /><Profile label="Mass" value={ship.performance.hullMass} suffix=" t" /></dl><section className="capacity-matrix"><header><h3>Frame capacity</h3><small>{slotCount} positions</small></header><div><CapacityRow label="Core" slots={ship.slots.core} /><CapacityRow label="Optional" slots={ship.slots.optional} /><CapacityRow label="Hardpoints" slots={ship.slots.hardpoints} /><CapacityRow label="Utility" slots={ship.slots.utilities} /></div></section></article>
}

function Profile({ label, suffix = '', value }: { label: string, suffix?: string, value: number | null }) { return <div><dt>{label}</dt><dd>{value === null ? '—' : `${value.toLocaleString()}${suffix}`}</dd></div> }
function CapacityRow({ label, slots }: { label: string, slots: Array<{ size: number }> }) { return <section><header><h4>{label}</h4><small>{slots.length}</small></header><ol>{slots.map((slot, index) => <li key={`${label}-${index}`}>S{slot.size}</li>)}</ol></section> }

const PAD_ORDER = { small: 1, medium: 2, large: 3 } as const
const SHIP_CATALOGUE_COLUMNS: readonly SortableDataTableColumn<ShipDefinition>[] = [
  { cell: ship => ship.displayName, heading: 'Hull', id: 'hull', rowHeader: true, sortValue: ship => ship.displayName },
  { cell: ship => ship.manufacturer ?? '—', heading: 'Manufacturer', id: 'manufacturer', sortValue: ship => ship.manufacturer },
  { cell: ship => ship.landingPadSize ?? '—', heading: 'Pad', id: 'pad', sortValue: ship => ship.landingPadSize === null ? null : PAD_ORDER[ship.landingPadSize] },
  { cell: ship => ship.performance.baseArmour ?? '—', className: 'numeric', heading: 'Armour', id: 'armour', sortValue: ship => ship.performance.baseArmour },
  { cell: ship => ship.performance.baseShieldStrength ?? '—', className: 'numeric', heading: 'Shield', id: 'shield', sortValue: ship => ship.performance.baseShieldStrength },
  { cell: ship => ship.performance.speed ?? '—', className: 'numeric', heading: 'Speed', id: 'speed', sortValue: ship => ship.performance.speed },
  { cell: ship => ship.performance.boost ?? '—', className: 'numeric', heading: 'Boost', id: 'boost', sortValue: ship => ship.performance.boost },
  { cell: ship => ship.performance.hullMass ?? '—', className: 'numeric', heading: 'Mass', id: 'mass', sortValue: ship => ship.performance.hullMass }
]

function CatalogueTable({ current, onSelect, ships }: { current?: string, onSelect(ship: ShipDefinition): void, ships: readonly ShipDefinition[] }) {
  return <div className="catalogue-table-view"><SortableDataTable
    columns={SHIP_CATALOGUE_COLUMNS}
    density="compact"
    label="Known ship hulls"
    rowKey={ship => ship.id}
    rowProps={ship => ({
      'aria-selected': ship.id === current,
      className: ship.id === current ? 'active' : undefined,
      onClick: () => onSelect(ship),
      onKeyDown: event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect(ship)
        }
      },
      tabIndex: 0
    })}
    rows={ships}
    scheme="surface"
    stickyHeader
  /></div>
}

function titleFor(view: FleetView): string {
  if (view === 'overview') return 'Fleet'
  if (view === 'stored-modules') return 'Stored modules'
  if (view === 'catalogue') return 'Ship catalogue'
  if (view === 'carriers') return 'Fleet carriers'
  return 'Current ship'
}

function TableIcon() { return <svg aria-hidden="true" viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="11" /><path d="M1.5 6h13M1.5 9.75h13M6 2.5v11" /></svg> }
function TilesIcon() { return <svg aria-hidden="true" viewBox="0 0 16 16"><rect x="1.5" y="1.5" width="5" height="5" /><rect x="9.5" y="1.5" width="5" height="5" /><rect x="1.5" y="9.5" width="5" height="5" /><rect x="9.5" y="9.5" width="5" height="5" /></svg> }
function DossierIcon() { return <svg aria-hidden="true" viewBox="0 0 16 16"><rect x="1.5" y="2.5" width="13" height="11" /><path d="M6 2.5v11M3.25 5h1.25M3.25 8h1.25M3.25 11h1.25M8 5h4.25M8 8h4.25" /></svg> }
