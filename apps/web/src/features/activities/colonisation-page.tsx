import { useState } from 'react'
import { Breadcrumbs, DataTable, DataTableGroup, DescriptionItem, DescriptionList, Inline, Loading, PageFrame, PageHeader, Stack, Status, Tabs, ThirdsGrid } from '@phoenix/ui'
import type { ColonisationDepot, ColonisationResponse } from '@phoenix/contracts'
import type { ActivitiesControllerSnapshot } from './use-activities-controller.js'
import { PhoenixDateTime } from '../../components/phoenix-date-time.js'
import { SystemLocationLink } from '../../components/system-location-link.js'

const tabs = ['Construction', 'Claims', 'Contributions'].map(label => ({ id: `colonisation-${label.toLowerCase()}`, label, panelId: 'colonisation-panel' }))

export function ColonisationPage({ controller }: { controller: ActivitiesControllerSnapshot }) {
  const [tab, setTab] = useState('colonisation-construction')
  const data = controller.colonisation
  return <PageFrame layout="fit"><Stack fill gap="sm">
    <PageHeader variant="cockpit" title="Colonisation" context={<Breadcrumbs items={[{ label: 'Activities', href: '#/activities/missions' }, { label: 'Colonisation' }]} />}
      status={<Inline justify="end"><Status tone="danger">Work in progress</Status><span>Journal observations</span></Inline>} />
    {controller.error ? <Status wrap tone="danger">{controller.error}</Status> : null}
    {!data ? controller.status === 'error' ? null : <Loading>Loading construction records…</Loading> : <>
      <Tabs current={tab} items={tabs} label="Colonisation views" onSelect={setTab} />
      <Stack fill gap="lg" id="colonisation-panel" role="tabpanel" aria-labelledby={tab}>
        {tab === 'colonisation-construction' ? <Construction data={data} /> : null}
        {tab === 'colonisation-claims' ? <Claims data={data} /> : null}
        {tab === 'colonisation-contributions' ? <Contributions data={data} /> : null}
      </Stack>
    </>}
  </Stack></PageFrame>
}

function Construction({ data }: { data: ColonisationResponse }) {
  const [selectedId, setSelectedId] = useState<number>()
  const selected = selectedId === undefined ? data.depots[0] : data.depots.find(depot => depot.marketId === selectedId)
  return <ThirdsGrid fill gap="lg"><DataTableGroup fill title="Construction sites" meta={`${data.depots.length} sites`}>
    {!data.depots.length ? <Status wrap tone="muted">No construction depot observed. Open a construction depot in game to publish its progress and supply requirements.</Status>
      : <DataTable label="Construction sites" density="compact" narrow="priority" scheme="surface" stickyHeader><thead><tr><th>Observed sites</th></tr></thead>
        <tbody>{data.depots.map(depot => <tr key={depot.marketId} className={depot.marketId === selected?.marketId ? 'active' : undefined}
          aria-selected={depot.marketId === selected?.marketId} tabIndex={0} onClick={() => setSelectedId(depot.marketId)}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(depot.marketId) } }}>
          <td>{depot.station ?? `Depot ${depot.marketId}`}<small>{depot.system ?? 'System not observed'}</small><small>{status(depot)} · {(depot.progress * 100).toLocaleString()}%</small></td>
        </tr>)}</tbody></DataTable>}
    <small>Visited depots, not an ownership manifest. Totals reflect the last depot snapshot; other commanders may have delivered since.</small>
  </DataTableGroup><div className="span-two"><Stack fill gap="lg">
    {selected ? <DepotDetails depot={selected} /> : <Status wrap tone="muted">Select a construction site to see supplies.</Status>}
  </Stack></div></ThirdsGrid>
}

function DepotDetails({ depot }: { depot: ColonisationDepot }) {
  return <Stack fill gap="lg"><DataTableGroup title="Construction site" contentGap="sm">
    <SystemLocationLink systemName={depot.system} locationName={depot.station} />
    <DescriptionList columns="one" density="compact"><DescriptionItem label="Market ID" value={depot.marketId} /><DescriptionItem label="Status" value={status(depot)} />
      <DescriptionItem label="Progress" value={`${(depot.progress * 100).toLocaleString()}%`} /><DescriptionItem label="Observed" value={<PhoenixDateTime value={depot.updatedAt} />} /></DescriptionList>
  </DataTableGroup><DataTableGroup fill title="Supply requirements" meta="Tonnes">
    {!depot.resources.length ? <Status wrap tone="muted">No supply requirements in this depot snapshot.</Status> : <DataTable label="Construction supply requirements" density="compact" scheme="surface" stickyHeader><thead><tr><th>Commodity</th><th className="numeric">Provided</th><th className="numeric">Required</th><th className="numeric">Remaining</th></tr></thead>
      <tbody>{depot.resources.map(resource => <tr key={resource.id}><td>{resource.name}</td><td className="numeric">{resource.provided.toLocaleString()}</td><td className="numeric">{resource.required.toLocaleString()}</td><td className="numeric">{Math.max(0, resource.required - resource.provided).toLocaleString()}</td></tr>)}</tbody></DataTable>}
  </DataTableGroup></Stack>
}

function Claims({ data }: { data: ColonisationResponse }) {
  return <DataTableGroup fill title="Observed claims" meta={`${data.claims.length} systems`}>
    <Status wrap tone="muted">Claim/release observations only. This is not a complete list of your colonies or a claim of current System Architect ownership.</Status>
    {data.claims.length ? <DataTable label="Colonisation claims" density="compact" scheme="surface" stickyHeader><thead><tr><th>System</th><th>Last event</th><th>Observed</th></tr></thead><tbody>
      {data.claims.map(claim => <tr key={claim.systemAddress}><td><SystemLocationLink systemName={claim.system} /></td><td>{claim.status === 'claimed' ? 'Claimed' : 'Claim released'}</td><td><PhoenixDateTime value={claim.updatedAt} /></td></tr>)}
    </tbody></DataTable> : <Status wrap tone="muted">No system claim observed in retained journals.</Status>}
    <small>Completed construction stays in Construction. Post-construction facility management and income are not yet verified.</small>
  </DataTableGroup>
}

function Contributions({ data }: { data: ColonisationResponse }) {
  return <DataTableGroup fill title="Personal contributions" meta={`${data.contributions.length} of ${data.retainedContributions} deliveries`}>
    {data.contributions.length ? <DataTable label="Colonisation contributions" density="compact" scheme="surface" stickyHeader><thead><tr><th>Observed</th><th>Site</th><th>Commodity</th><th className="numeric">Tonnes</th></tr></thead><tbody>
      {data.contributions.flatMap(delivery => delivery.items.map(item => <tr key={`${delivery.id}:${item.id}`}><td><PhoenixDateTime value={delivery.timestamp} /></td>
        <td>{delivery.system ? <SystemLocationLink systemName={delivery.system} locationName={delivery.station} /> : `Depot ${delivery.marketId}`}</td><td>{item.name}</td><td className="numeric">{item.amount.toLocaleString()}</td></tr>))}
    </tbody></DataTable> : <Status wrap tone="muted">No personal construction delivery observed.</Status>}
    <small>Personal deliveries are not added to depot totals locally. The next depot snapshot establishes the global balance.</small>
  </DataTableGroup>
}

function status(depot: ColonisationDepot) { return depot.failed ? 'Failed' : depot.complete ? 'Complete' : 'Building' }
