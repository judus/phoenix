import {
  AutoGrid,
  Breadcrumbs,
  DataTable,
  DataTableGroup,
  Meter,
  Metric,
  PageFrame,
  PageHeader,
  Section,
  Stack,
  Status
} from '@phoenix/ui'
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

  return (
    <PageFrame className="commander-page" layout="fit">
      <div className="commander-layout">
        <CommanderHeader model={model} view={view} />
        <Stack className="commander-content" gap="xl" tabIndex={0}>
          {view === 'career' && <CommanderCareer model={model} />}
          {view === 'statistics' && <CommanderStatistics statistics={model.statistics} />}
          {view === 'inventory' && <CommanderInventory stores={model.stores} />}
        </Stack>
      </div>
    </PageFrame>
  )
}

function CommanderHeader({ model, view }: { model?: CommanderViewModel, view: CommanderView }) {
  const section = view === 'career' ? 'Career' : view === 'statistics' ? 'Lifetime Statistics' : 'Personal Stores'

  return (
    <PageHeader
      variant="cockpit"
      context={<Breadcrumbs items={[{ label: 'Commander', href: '#/commander/career' }, { label: section }]} />}
      title={`CMDR ${model?.name ?? 'Unknown'}`}
      status={view === 'statistics' && model?.statistics ? `Reported ${model.statistics.updatedAt}` : undefined}
    />
  )
}

function CommanderCareer({ model }: { model: CommanderViewModel }) {
  return (
    <>
      <Section title="Career ranks" description="Percentages show progress toward the next rank.">
        <DataTable className="commander-progress" density="compact" label="Commander career ranks" narrow="priority" scheme="surface">
          <thead><tr><th>Discipline</th><th>Reported level</th><th>Progress</th></tr></thead>
          <tbody>
            {model.ranks.map(rank => (
              <tr key={rank.id}>
                <th scope="row"><strong>{rank.label}</strong><small>{rank.group === 'pilot' ? 'Pilots Federation' : 'Superpower navy'}</small></th>
                <td>{rank.level}</td>
                <td>
                  <Meter className="commander-rank-meter" label={`${rank.label} progress`} layout="inline" value={rank.progress ?? 0} valueLabel={rank.progressLabel} />
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </Section>

      <Section divider title="Galactic reputation" description="Standing reported on Frontier's −100 to +100 scale.">
        <AutoGrid className="commander-reputation" gap="lg" minimum="md">
          {model.reputation.map(reputation => (
            <DataTableGroup key={reputation.id} meta={reputation.status} title={reputation.label}>
              <Metric density="compact" label="Reputation" value={reputation.valueLabel} />
            </DataTableGroup>
          ))}
        </AutoGrid>
      </Section>
    </>
  )
}

function CommanderStatistics({ statistics }: { statistics: CommanderViewModel['statistics'] }) {
  if (!statistics) {
    return <Status tone="muted">Lifetime statistics have not been reported by the game yet.</Status>
  }
  if (statistics.groups.length === 0) {
    return <Status tone="muted">The game reported an empty lifetime statistics snapshot.</Status>
  }

  return (
    <AutoGrid className="commander-statistics" gap="lg" minimum="xl">
      {statistics.groups.map(group => (
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
    </AutoGrid>
  )
}

function CommanderInventory({ stores }: { stores: CommanderViewModel['stores'] }) {
  return <>{stores.map(store => <StoreGroup key={store.title} store={store} />)}</>
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
