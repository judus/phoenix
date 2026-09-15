import {
  AutoGrid,
  Breadcrumbs,
  DataTable,
  DataTableGroup,
  PageFrame,
  PageHeader,
  Stack,
  Status
} from '@phoenix/ui'
import { UpdatedDateTime } from '../../components/phoenix-date-time.js'
import type { RuntimeStateSnapshot } from '../../application/runtime/runtime-state-store.js'
import type { CommanderViewModel } from './commander-view-model.js'
import { CommanderEquipmentPage } from './commander-equipment-page.js'
import type { CommanderEquipmentControllerSnapshot } from './use-commander-equipment-controller.js'

export type CommanderView = 'career' | 'statistics' | 'inventory' | 'equipment'

export function CommanderPage({ equipment, model, runtime, view }: {
  equipment?: CommanderEquipmentControllerSnapshot
  model?: CommanderViewModel
  runtime: RuntimeStateSnapshot
  view: CommanderView
}) {
  if (view === 'equipment') return <CommanderEquipmentPage controller={equipment ?? { status: 'idle' }} />

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

function CommanderHeader({ model, view }: { model?: CommanderViewModel, view: Exclude<CommanderView, 'equipment'> }) {
  const section = view === 'career' ? 'Career' : view === 'statistics' ? 'Lifetime Statistics' : 'Personal Stores'

  return (
    <PageHeader
      variant="cockpit"
      context={<Breadcrumbs items={[{ label: 'Commander', href: '#/commander/career' }, { label: section }]} />}
      title={section}
      status={view === 'statistics' && model?.statistics ? <UpdatedDateTime value={model.statistics.updatedAt} /> : undefined}
    />
  )
}

function CommanderCareer({ model }: { model: CommanderViewModel }) {
  const pilotRanks = model.ranks.filter(rank => rank.group === 'pilot')
  const navalRanks = model.ranks.filter(rank => rank.group === 'superpower')

  return (
    <>
      <DataTableGroup title="Pilots Federation ranks">
        <DataTable className="commander-career-table" density="compact" label="Pilots Federation ranks" narrow="priority" scheme="surface">
          <thead><tr><th>Career</th><th>Rank</th><th className="numeric">Progress</th></tr></thead>
          <tbody>{pilotRanks.map(rank => (
            <tr key={rank.id}>
              <th scope="row"><strong>{rank.label}</strong></th>
              <td>{rank.level}</td>
              <td className="numeric">{rank.progressLabel}</td>
            </tr>
          ))}</tbody>
        </DataTable>
      </DataTableGroup>

      <DataTableGroup title="Superpowers">
        <DataTable className="commander-superpower-table" density="compact" label="Superpower ranks and reputation" narrow="priority" scheme="surface">
          <thead><tr><th>Power</th><th>Naval rank</th><th className="numeric priority-tertiary">Rank progress</th><th className="numeric">Reputation</th><th className="priority-secondary">Standing</th></tr></thead>
          <tbody>{model.reputation.map(reputation => {
            const navalRank = navalRanks.find(rank => rank.id === reputation.id)
            return (
              <tr key={reputation.id}>
                <th scope="row"><strong>{reputation.label}</strong></th>
                <td>{navalRank?.level ?? '—'}</td>
                <td className="numeric priority-tertiary">{navalRank?.progressLabel ?? '—'}</td>
                <td className="numeric">{reputation.valueLabel}</td>
                <td className="priority-secondary">{reputation.status}</td>
              </tr>
            )
          })}</tbody>
        </DataTable>
      </DataTableGroup>
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
                <thead><tr><th>Record</th><th className="numeric">Value</th></tr></thead>
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
          <DataTable density="compact" key={category.title} label={`${category.title} in ${store.title.toLowerCase()}`} narrow="priority" scheme="surface">
            <thead><tr><th>{category.title}</th><th className="numeric">{category.count}</th></tr></thead>
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
        ))}
      </AutoGrid>
    </DataTableGroup>
  )
}
