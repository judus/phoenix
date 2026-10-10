import { useState } from 'react'
import type { PowerplayEntry, PowerplayResponse, PowerplayTarget } from '@phoenix/contracts'
import {
  Breadcrumbs, Button, DataTable, DataTableGroup, DescriptionItem, DescriptionList, Field,
  Form, FormActions, FormGrid, Inline, Loading, NumberInput, PageFrame, PageHeader, Stack, Status,
  Tabs, TextInput, ThirdsGrid
} from '@phoenix/ui'
import type { PowerplayController } from './use-powerplay-controller.js'
import { UpdatedDateTime, PhoenixDateTime } from '../../components/phoenix-date-time.js'

const tabs = ['Overview', 'Activity', 'Target'].map(label => ({ id: `powerplay-${label.toLowerCase()}`, label, panelId: 'powerplay-panel' }))
const number = (value: number | null) => value === null ? 'Unknown' : value.toLocaleString()

export function PowerplayPage({ controller }: { controller: PowerplayController }) {
  const [tab, setTab] = useState('powerplay-overview')
  return <PageFrame layout="fit"><Stack fill gap="sm">
    <PageHeader variant="cockpit" title="Powerplay"
      context={<Breadcrumbs items={[{ label: 'Activities', href: '#/activities/missions' }, { label: 'Powerplay' }]} />}
      status={<Inline gap="sm" justify="end"><Status tone="danger">Work in progress</Status>
        {controller.data?.pledge.updatedAt ? <UpdatedDateTime value={controller.data.pledge.updatedAt} /> : 'Journal observations'}</Inline>} />
    {controller.error ? <Status wrap tone="danger">{controller.error}</Status> : null}
    {!controller.data ? controller.status === 'loading' ? <Loading>Loading Powerplay…</Loading> : null : <>
      <Tabs current={tab} items={tabs} label="Powerplay views" onSelect={setTab} />
      <Stack fill gap="lg" id="powerplay-panel" role="tabpanel" aria-labelledby={tab}>
        {tab === 'powerplay-overview' ? <Overview data={controller.data} /> : null}
        {tab === 'powerplay-activity' ? <Ledger data={controller.data} /> : null}
        {tab === 'powerplay-target' ? <Target key={JSON.stringify(controller.data.target)} data={controller.data}
          saving={controller.saving} onSave={controller.saveTarget} /> : null}
      </Stack>
    </>}
  </Stack></PageFrame>
}

function Overview({ data }: { data: PowerplayResponse }) {
  const pledge = data.pledge
  return <ThirdsGrid fill gap="lg">
    <div className="span-two"><Stack gap="lg" fill>
      <DataTableGroup title="Pledge" contentGap="sm">
        {pledge.status === 'unknown' ? <Status wrap tone="muted">No personal Powerplay observation yet. Re-enter your commander session while pledged to publish a snapshot.</Status>
          : pledge.status === 'left' ? <Status wrap tone="muted">You left your last observed Power. No later pledge has been recorded.</Status> : null}
        <DescriptionList columns="two">
          <DescriptionItem label="Power" value={pledge.power ?? '—'} />
          <DescriptionItem label="Rank" value={number(pledge.rank)} />
          <DescriptionItem label="Total merits" value={number(pledge.merits)} />
          <DescriptionItem label="Pledged since" value={pledge.pledgedAt ? <PhoenixDateTime value={pledge.pledgedAt} /> : 'Unknown'} />
          <DescriptionItem label="Rank observed" value={pledge.rankAt ? <PhoenixDateTime value={pledge.rankAt} /> : '—'} />
          <DescriptionItem label="Merits observed" value={pledge.meritsAt ? <PhoenixDateTime value={pledge.meritsAt} /> : '—'} />
        </DescriptionList>
      </DataTableGroup>
      <DataTableGroup title="Recent activity" contentGap="sm"><Entries entries={data.entries.filter(entry => entry.kind !== 'snapshot').slice(0, 6)} /></DataTableGroup>
    </Stack></div>
    <Stack gap="lg">
      <DataTableGroup title="Pinned target" contentGap="sm"><TargetSummary data={data} /></DataTableGroup>
      <DataTableGroup title="What is tracked" contentGap="sm">
        <p>Pledge changes, reported rank, authoritative merit totals, and observed collections/deliveries.</p>
        <small>Weekly assignments and claimed care packages are not reported here. Merit gains are not attributed to a nearby combat or trade event.</small>
      </DataTableGroup>
    </Stack>
  </ThirdsGrid>
}

function Ledger({ data }: { data: PowerplayResponse }) {
  return <DataTableGroup fill title="Powerplay activity" meta={`${data.entries.length} of ${data.retained} observations`}>
    <Entries entries={data.entries} />
  </DataTableGroup>
}

const labels: Record<PowerplayEntry['kind'], string> = {
  snapshot: 'Session snapshot', join: 'Pledged', leave: 'Left Power', defect: 'Defected',
  merits: 'Merits earned', rank: 'Rank changed', collect: 'Collected', deliver: 'Delivered'
}

function Entries({ entries }: { entries: PowerplayEntry[] }) {
  if (!entries.length) return <Status wrap tone="muted">No Powerplay activity observed.</Status>
  return <DataTable label="Powerplay observations" density="compact" scheme="surface" stickyHeader><thead><tr>
    <th>Observed</th><th>Activity</th><th>Power</th><th className="numeric">Merits / details</th>
  </tr></thead><tbody>{entries.map(entry => <tr key={entry.id}>
    <td><PhoenixDateTime value={entry.timestamp} /></td><td>{labels[entry.kind]}</td><td>{entry.power}</td>
    <td className="numeric">{entry.kind === 'merits' ? `${entry.gained! >= 0 ? '+' : ''}${number(entry.gained)} · total ${number(entry.merits)}`
      : entry.kind === 'rank' || entry.kind === 'snapshot' ? `Rank ${number(entry.rank)}${entry.merits !== null ? ` · ${number(entry.merits)} merits` : ''}`
        : entry.item ? `${number(entry.count)} × ${entry.item}` : entry.fromPower ? `From ${entry.fromPower}` : '—'}</td>
  </tr>)}</tbody></DataTable>
}

function TargetSummary({ data }: { data: PowerplayResponse }) {
  if (!data.target) return <Status wrap tone="muted">No target pinned. Use Target to track a module or perk.</Status>
  return <Stack gap="sm"><strong className="text-action">{data.target.name}</strong>
    <DescriptionList columns="one" density="compact">
      <DescriptionItem label="Power" value={data.target.power} />
      {data.target.rank !== null ? <DescriptionItem label="Required rank" value={number(data.target.rank)} /> : null}
      {data.target.merits !== null ? <DescriptionItem label="Required merits" value={number(data.target.merits)} /> : null}
      <DescriptionItem label="Merits remaining" value={number(data.targetProgress?.remainingMerits ?? null)} />
    </DescriptionList>
    <Status wrap tone={data.targetProgress?.status === 'requirements-met' ? 'positive' : 'muted'}>
      {data.targetProgress?.status === 'requirements-met' ? 'Recorded requirements met. Confirm the unlock in game.'
        : data.targetProgress?.status === 'different-power' ? 'This target belongs to another Power; progress is not compared.'
          : data.targetProgress?.status === 'unknown' ? 'Awaiting the required journal observations.' : 'Working toward your target.'}
    </Status>
    <small>Player-entered requirements. This is not proof of acquisition, starter assignment completion or a reward claim.</small>
  </Stack>
}

function Target({ data, saving, onSave }: { data: PowerplayResponse, saving: boolean, onSave(target: PowerplayTarget | null): Promise<void> }) {
  const [name, setName] = useState(data.target?.name ?? '')
  const [power, setPower] = useState(data.target?.power ?? data.pledge.power ?? '')
  const [rank, setRank] = useState(data.target?.rank?.toString() ?? '')
  const [merits, setMerits] = useState(data.target?.merits?.toString() ?? '')
  const [error, setError] = useState<string>()
  const save = async (target: PowerplayTarget | null) => {
    setError(undefined)
    try { await onSave(target) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Target could not be saved.') }
  }
  return <ThirdsGrid fill gap="lg"><div className="span-two"><Form onSubmit={event => {
    event.preventDefault()
    if (!rank && !merits) { setError('Enter a required rank or merit total.'); return }
    void save({ name, power, rank: rank === '' ? null : Number(rank), merits: merits === '' ? null : Number(merits) })
  }}>
    <FormGrid>
      <Field htmlFor="powerplay-target-name" label="Module or perk" required><TextInput value={name} maxLength={120} required disabled={saving} onChange={event => setName(event.target.value)} /></Field>
      <Field htmlFor="powerplay-target-power" label="Power" required><TextInput value={power} maxLength={120} required disabled={saving} onChange={event => setPower(event.target.value)} /></Field>
      <Field htmlFor="powerplay-target-rank" label="Required rank"><NumberInput value={rank} min={0} step={1} disabled={saving} onChange={event => setRank(event.target.value)} /></Field>
      <Field htmlFor="powerplay-target-merits" label="Required merits"><NumberInput value={merits} min={0} step="any" disabled={saving} onChange={event => setMerits(event.target.value)} /></Field>
    </FormGrid>
    <small>Copy requirements from your in-game loyalty screen. Automatic reward catalogue suggestions come after verification.</small>
    <FormActions message={error}><Button type="submit" disabled={saving}>Pin target</Button>
      {data.target ? <Button type="button" variant="outline" disabled={saving} onClick={() => void save(null)}>Clear target</Button> : null}
    </FormActions>
  </Form></div><DataTableGroup title="Target progress" contentGap="sm"><TargetSummary data={data} /></DataTableGroup></ThirdsGrid>
}
