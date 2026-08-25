import {
  AutoGrid,
  Breadcrumbs,
  DashboardGrid,
  DataTable,
  DataTableGroup,
  Meter,
  Metric,
  PageFrame,
  PageHeader,
  Section,
  Stack,
  Status,
  Widget
} from '@phoenix/ui'
import { CommanderSummaryWidget } from '../../components/commander-summary-widget.js'
import type { RuntimeStateSnapshot } from '../../application/runtime/runtime-state-store.js'
import type { CommanderViewModel } from './commander-view-model.js'

export type CommanderView = 'career' | 'statistics' | 'inventory'

export function CommanderPage({ model, runtime, view }: {
  model?: CommanderViewModel
  runtime: RuntimeStateSnapshot
  view: CommanderView
}) {
  if (runtime.status !== 'ready' || !model) {
    return (
      <PageFrame className="commander-page" layout="fit" aria-busy={runtime.status !== 'error'}>
        <div className="commander-layout">
          <CommanderHeader view={view} />
          <Status tone={runtime.status === 'error' ? 'danger' : 'muted'}>
            {runtime.status === 'error' ? runtime.error : 'Waiting for commander telemetry…'}
          </Status>
        </div>
      </PageFrame>
    )
  }

  if (view === 'career') {
    return (
      <PageFrame className="commander-page commander-career-page" layout="fit">
        <CommanderCareer model={model} />
      </PageFrame>
    )
  }

  return (
    <PageFrame className="commander-page" layout="fit">
      <div className="commander-layout">
        <CommanderHeader model={model} view={view} />
        <Stack className="commander-content" gap="xl" tabIndex={0}>
          {view === 'statistics' && <CommanderStatistics statistics={model.statistics} />}
          {view === 'inventory' && <CommanderInventory stores={model.stores} />}
        </Stack>
      </div>
    </PageFrame>
  )
}

function CommanderHeader({ model, view }: { model?: CommanderViewModel, view: CommanderView }) {
  const section = view === 'career' ? 'Career' : view === 'statistics' ? 'Lifetime Statistics' : 'Personal Stores'
  const contextualPage = view !== 'career'

  return (
    <PageHeader
      variant="cockpit"
      context={<Breadcrumbs items={[{ label: 'Commander', href: '#/commander/career' }, { label: section }]} />}
      title={contextualPage ? section : `CMDR ${model?.name ?? 'Unknown'}`}
      status={view === 'statistics' && model?.statistics ? `Reported ${model.statistics.updatedAt}` : undefined}
    />
  )
}

function CommanderCareer({ model }: { model: CommanderViewModel }) {
  const pilotRanks = model.ranks.filter(rank => rank.group === 'pilot')
  const navalRanks = model.ranks.filter(rank => rank.group === 'superpower')

  return (
    <DashboardGrid
      className="commander-career-dashboard"
      gap="xs"
      aria-label={`Career dashboard for CMDR ${model.name}`}
      lastRow={(
        <div className="commander-career-rows span-full gap-xs">
          <AutoGrid className="commander-naval-ranks" gap="xs" minimum="xl">
            {navalRanks.map(rank => <RankCard key={rank.id} rank={rank} />)}
          </AutoGrid>
          <AutoGrid className="commander-ranks" gap="xs" minimum="lg">
            {pilotRanks.slice(0, 3).map(rank => <RankCard key={rank.id} rank={rank} />)}
          </AutoGrid>
          <AutoGrid className="commander-ranks" gap="xs" minimum="lg">
            {pilotRanks.slice(3).map(rank => <RankCard key={rank.id} rank={rank} />)}
          </AutoGrid>
          <AutoGrid className="commander-standing-grid" gap="xs" minimum="md">
            {model.reputation.map(reputation => (
              <StandingCard key={reputation.id} reputation={reputation} />
            ))}
          </AutoGrid>
        </div>
      )}
    >
      <CommanderSummaryWidget
        className="span-full"
        credits={model.legal.credits}
        legalState={model.legal.state}
        name={model.name}
        notoriety={model.legal.notoriety}
      />
    </DashboardGrid>
  )
}

function RankCard({ rank }: { rank: CommanderViewModel['ranks'][number] }) {
  return (
    <Widget className="commander-rank-card" density="compact" title={rank.label}>
      <Stack gap="sm">
        <Metric value={rank.level.toUpperCase()} />
        <Meter
          label={`${rank.label} progress`}
          layout="compact"
          tone="action"
          value={rank.progress ?? 0}
          valueLabel={rank.progressLabel}
        />
      </Stack>
    </Widget>
  )
}

function StandingCard({ reputation }: {
  reputation: CommanderViewModel['reputation'][number]
}) {
  return (
    <Widget className="commander-reputation-card" density="compact" meta={reputation.status} title={reputation.label}>
      <Stack gap="sm">
        <Meter
          label={`${reputation.label} reputation`}
          layout="compact"
          max={200}
          tone="action"
          value={reputation.value === null ? 0 : reputation.value + 100}
          valueLabel={reputation.valueLabel}
        />
      </Stack>
    </Widget>
  )
}

function CommanderStatistics({ statistics }: { statistics: CommanderViewModel['statistics'] }) {
  if (!statistics) {
    return <Status tone="muted">Lifetime statistics have not been reported by the game yet.</Status>
  }
  if (statistics.groups.length === 0) {
    return <Status tone="muted">The game reported an empty lifetime statistics snapshot.</Status>
  }

  const columns = statistics.groups.length === 1
    ? [statistics.groups]
    : [
        statistics.groups.filter((_, index) => index % 2 === 0),
        statistics.groups.filter((_, index) => index % 2 === 1)
      ]

  return (
    <AutoGrid className="commander-statistics" gap="lg" minimum="xl">
      {columns.map((groups, index) => (
        <Stack key={index} className="commander-statistics-column" gap="lg">
          {groups.map(group => (
            <DataTableGroup key={group.id} meta={`${group.metrics.length} records`} title={group.label}>
              <DataTable density="compact" label={`${group.label} lifetime statistics`} narrow="priority" scheme="surface">
                <thead><tr><th>Record</th><th>Value</th></tr></thead>
                <tbody>
                  {group.metrics.map(metric => (
                    <tr key={metric.id}>
                      <th scope="row">{metric.label}</th>
                      <td className="numeric">{metric.value}</td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </DataTableGroup>
          ))}
        </Stack>
      ))}
    </AutoGrid>
  )
}

function CommanderInventory({ stores }: { stores: CommanderViewModel['stores'] }) {
  return (
    <AutoGrid className="commander-stores" gap="xl" minimum="xl">
      {stores.map(store => <StoreGroup key={store.title} store={store} />)}
    </AutoGrid>
  )
}

function StoreGroup({ store }: { store: CommanderViewModel['stores'][number] }) {
  return (
    <DataTableGroup className="commander-store" meta={store.meta} title={store.title}>
      <AutoGrid gap="md" minimum="xl">
        {store.categories.map(category => (
          <DataTableGroup key={category.title} meta={category.count} title={category.title} tone="muted">
            <DataTable density="compact" label={`${category.title} in ${store.title.toLowerCase()}`} narrow="priority" scheme="surface">
              <tbody>
                {category.items.length === 0
                  ? <tr><td className="text-muted" colSpan={2}>None</td></tr>
                  : category.items.map(item => (
                      <tr key={item.key}>
                        <td><strong>{item.name}</strong><small>{item.identifier} · {item.provenance}</small></td>
                        <td className="numeric">{item.quantity}</td>
                      </tr>
                    ))}
              </tbody>
            </DataTable>
          </DataTableGroup>
        ))}
      </AutoGrid>
    </DataTableGroup>
  )
}
