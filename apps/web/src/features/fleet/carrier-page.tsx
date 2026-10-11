import { useState } from 'react'
import type { FleetCarrier, FleetResponse } from '@phoenix/contracts'
import { Breadcrumbs, DataTable, DataTableGroup, DescriptionItem, DescriptionList, Inline, PageFrame, PageHeader, Stack, Status, Tabs, ThirdsGrid } from '@phoenix/ui'
import { PhoenixDateTime } from '../../components/phoenix-date-time.js'
import { SystemLocationLink } from '../../components/system-location-link.js'

const tabs = ['Overview', 'Services', 'Ships', 'History'].map(label => ({ id: `carrier-${label.toLowerCase()}`, label, panelId: 'carrier-panel' }))
export function CarrierPage({ fleet, error }: { fleet: FleetResponse, error?: string }) {
  const [selectedId, setSelectedId] = useState<number>()
  const [tab, setTab] = useState('carrier-overview')
  const carrier = fleet.carriers.items.find(item => item.id === selectedId) ?? fleet.carriers.items[0]
  return <PageFrame layout="fit"><Stack fill gap="sm">
    <PageHeader variant="cockpit" title="Fleet carriers" context={<Breadcrumbs items={[{ label: 'Fleet', href: '#/fleet/overview' }, { label: 'Carriers' }]} />}
      status={<Inline justify="end"><Status tone="danger">Work in progress</Status><span>Journal observations</span></Inline>} />
    {error ? <Status tone="danger" wrap>{error}</Status> : null}
    {!carrier ? <Status tone="muted" wrap>No managed carrier observed. Open Carrier Management in Elite to publish a snapshot. This does not mean you own no carrier.</Status> : <>
      <Tabs current={tab} items={tabs} label="Carrier views" onSelect={setTab} />
      <ThirdsGrid fill gap="lg"><DataTableGroup fill title="Managed carriers" meta={`${fleet.carriers.items.length} observed`}>
        <DataTable density="compact" label="Managed carriers" narrow="priority" scheme="surface"><tbody>{fleet.carriers.items.map(item => <tr key={item.id}
          className={item.id === carrier.id ? 'active' : undefined} aria-selected={item.id === carrier.id} tabIndex={0} onClick={() => setSelectedId(item.id)}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(item.id) } }}>
          <th scope="row">{item.name ?? item.callsign ?? `Carrier ${item.id}`}<small>{item.callsign ?? 'Callsign unknown'} · {item.type ?? 'Type unknown'}</small></th>
        </tr>)}</tbody></DataTable>
        <small>Management/purchase records only. Personal and squadron semantics still need gameplay validation.</small>
      </DataTableGroup><div className="span-two"><Stack className="fleet-scroll-content" fill gap="lg" id="carrier-panel" role="tabpanel" aria-labelledby={tab}>
        {tab === 'carrier-overview' ? <Overview carrier={carrier} /> : null}
        {tab === 'carrier-services' ? <Services carrier={carrier} /> : null}
        {tab === 'carrier-ships' ? <Ships carrier={carrier} fleet={fleet} /> : null}
        {tab === 'carrier-history' ? <History carrier={carrier} /> : null}
      </Stack></div></ThirdsGrid>
    </>}
  </Stack></PageFrame>
}
function Overview({ carrier }: { carrier: FleetCarrier }) {
  const { location, fuel, finance, capacity, access, jump } = carrier
  return <Stack gap="lg"><DataTableGroup title="Last observed state" contentGap="sm">
    {location ? <SystemLocationLink systemName={location.system} locationName={location.body} /> : <Status tone="muted">Location not observed.</Status>}
    <DescriptionList columns="one" density="compact">
      <DescriptionItem label="Management snapshot" value={carrier.snapshotAt ? <PhoenixDateTime value={carrier.snapshotAt} /> : 'Not observed'} />
      <DescriptionItem label="Location observed" value={location ? <PhoenixDateTime value={location.observedAt} /> : '—'} />
      <DescriptionItem label="Decommission pending" value={carrier.pendingDecommission === null ? 'Unknown' : carrier.pendingDecommission ? 'Yes' : 'No'} />
      <DescriptionItem label="Docking access" value={access?.docking ?? 'Unknown'} />
      <DescriptionItem label="Notorious docking" value={!access ? 'Unknown' : access.notorious ? 'Allowed' : 'Not allowed'} />
    </DescriptionList><small>Open Carrier Management to refresh. These are dated observations, not live telemetry or a current upkeep invoice.</small>
  </DataTableGroup><DataTableGroup title="Tritium and jump" contentGap="sm">
    <DescriptionList columns="one" density="compact"><DescriptionItem label="Tank" value={fuel ? quantity(fuel.tonnes, 't') : 'Unknown'} />
      <DescriptionItem label="Current jump range" value={quantity(fuel?.currentRange, 'LY')} /><DescriptionItem label="Maximum range" value={quantity(fuel?.maximumRange, 'LY')} />
      <DescriptionItem label="Fuel observed" value={fuel ? <PhoenixDateTime value={fuel.observedAt} /> : '—'} />
      <DescriptionItem label="Last jump request" value={jump ? `${jump.status.replaceAll('-', ' ')} · ${jump.system}` : 'Not observed'} />
      <DescriptionItem label="Scheduled departure" value={jump?.departureAt ? <PhoenixDateTime value={jump.departureAt} /> : '—'} />
    </DescriptionList><small>Tank fuel is not cargo tritium. A passed departure time is not proof of arrival.</small>
  </DataTableGroup><DataTableGroup title="Finances" contentGap="sm"><DescriptionList columns="one" density="compact">
    <DescriptionItem label="Carrier balance" value={quantity(finance?.balance, 'CR')} /><DescriptionItem label="Reserved" value={quantity(finance?.reserves, 'CR')} />
    <DescriptionItem label="Available" value={quantity(finance?.available, 'CR')} /><DescriptionItem label="Reserve percentage" value={quantity(finance?.reservePercent, '%')} />
    <DescriptionItem label="Observed" value={finance ? <PhoenixDateTime value={finance.observedAt} /> : '—'} />
  </DescriptionList><small>Transfers are financing, not profit. No inferred upkeep runway or due date.</small></DataTableGroup>
  <DataTableGroup title="Capacity snapshot" contentGap="sm"><DescriptionList columns="one" density="compact">
    <DescriptionItem label="Total" value={quantity(capacity?.total, 't')} /><DescriptionItem label="Free" value={quantity(capacity?.free, 't')} />
    <DescriptionItem label="Cargo" value={quantity(capacity?.cargo, 't')} /><DescriptionItem label="Reserved cargo" value={quantity(capacity?.reservedCargo, 't')} />
    <DescriptionItem label="Crew" value={quantity(capacity?.crew, 't')} /><DescriptionItem label="Ship sales packs" value={quantity(capacity?.shipPacks, 't')} />
    <DescriptionItem label="Module sales packs" value={quantity(capacity?.modulePacks, 't')} /><DescriptionItem label="Observed" value={capacity ? <PhoenixDateTime value={capacity.observedAt} /> : '—'} />
  </DescriptionList></DataTableGroup></Stack>
}
function Services({ carrier }: { carrier: FleetCarrier }) {
  const services = carrier.services
  return <DataTableGroup title="Service snapshot" contentGap="sm" meta={services ? <PhoenixDateTime value={services.observedAt} /> : undefined}>
    {services?.changedAt ? <Status wrap tone="information">Services changed after this snapshot. Open Carrier Management to refresh.</Status> : null}
    {!services ? <Status tone="muted" wrap>No service snapshot observed.</Status> : <DataTable label="Carrier services" density="compact" scheme="surface" stickyHeader><thead><tr><th>Service</th><th>Crew</th><th>Active</th><th>Enabled</th></tr></thead>
      <tbody>{services.items.map(item => <tr key={item.role}><th scope="row">{item.role}</th><td>{item.name ?? '—'}</td><td>{item.active ? 'Yes' : 'No'}</td><td>{item.enabled ? 'Yes' : 'No'}</td></tr>)}</tbody></DataTable>}
    <small>No individual service-cost or exact maintenance invoice is supplied by this view.</small>
  </DataTableGroup>
}
function Ships({ carrier, fleet }: { carrier: FleetCarrier, fleet: FleetResponse }) {
  const ships = fleet.ships.filter(ship => ship.marketId === carrier.id && (ship.state === 'stored-here' || ship.state === 'stored-remote'))
  return <DataTableGroup title="Your stored ships" contentGap="sm" meta={fleet.shipsSnapshotAt ? <PhoenixDateTime value={fleet.shipsSnapshotAt} /> : undefined}>
    {ships.length ? <DataTable label="Ships stored on carrier" density="compact" scheme="surface"><thead><tr><th>Ship</th><th>Identifier</th></tr></thead><tbody>{ships.map(ship => <tr key={ship.id}><td>{ship.name ?? ship.displayName ?? ship.typeId ?? `Ship ${ship.id}`}</td><td>{ship.identifier ?? '—'}</td></tr>)}</tbody></DataTable> : <Status wrap tone="muted">No personal stored ships associated with this carrier in the current fleet records.</Status>}
    <small>Your observed fleet only, not foreign visitors. Installed ship/module sales packs are separate stock.</small>
  </DataTableGroup>
}
function History({ carrier }: { carrier: FleetCarrier }) {
  return <DataTableGroup title="Observed history" contentGap="sm" meta={`Latest ${carrier.history.length} records`}>
    <DataTable label="Carrier history" density="compact" scheme="surface" stickyHeader><thead><tr><th>Observed</th><th>Event</th></tr></thead><tbody>{carrier.history.map(entry => <tr key={entry.id}><td><PhoenixDateTime value={entry.timestamp} /></td><td>{entry.description}</td></tr>)}</tbody></DataTable>
    <small>Observed events, not a complete customer transaction ledger, inventory or outstanding order book.</small>
  </DataTableGroup>
}
function quantity(value: number | null | undefined, unit: string) { return value == null ? 'Unknown' : `${value.toLocaleString()} ${unit}` }
