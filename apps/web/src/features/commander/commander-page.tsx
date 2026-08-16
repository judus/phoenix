import {
  AutoGrid,
  Breadcrumbs,
  DataTable,
  DataTableGroup,
  DescriptionItem,
  DescriptionList,
  Meter,
  PageFrame,
  PageHeader,
  Section,
  Stack,
  Status
} from '@phoenix/ui'
import type { RuntimeStateSnapshot } from '../../application/runtime/runtime-state-store.js'
import type { CommanderViewModel } from './commander-view-model.js'
export type CommanderView = 'overview' | 'inventory' | 'progress'

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
          {view === 'overview' && <CommanderOverview model={model} />}
          {view === 'inventory' && <CommanderInventory stores={model.stores} />}
          {view === 'progress' && <CommanderProgress ranks={model.ranks} />}
        </Stack>
      </div>
    </PageFrame>
  )
}

function CommanderHeader({ model, view }: { model?: CommanderViewModel, view: CommanderView }) {
  if (view === 'overview') {
    return (
      <PageHeader
        variant="entity"
        context="Commander profile"
        title={model?.name ?? 'Commander'}
        description={model ? `${model.situation.place} · ${model.situation.system}` : undefined}
        metadata={model ? `Current ship: ${model.situation.ship}` : undefined}
      />
    )
  }
  const title = view === 'inventory' ? 'Personal stores' : 'Career progress'
  return (
    <PageHeader
      variant="cockpit"
      context={<Breadcrumbs items={[{ label: 'Commander', href: '#/commander/overview' }, { label: title }]} />}
      title={title}
    />
  )
}

function CommanderOverview({ model }: { model: CommanderViewModel }) {
  return (
    <>
      <Section title="Current situation">
        <DescriptionList columns="two">
          <DescriptionItem label="System" value={model.situation.system} />
          <DescriptionItem label="Location" value={model.situation.place} />
          <DescriptionItem label="State" value={model.situation.locationState} />
          <DescriptionItem label="Current ship" value={model.situation.ship} />
        </DescriptionList>
      </Section>
      <Section divider title="Career ranks" description="Raw journal rank levels and reported progress.">
        <AutoGrid gap="lg" minimum="md">
          {model.ranks.map(rank => (
            <Meter
              key={rank.id}
              label={`${rank.label} · ${rank.level}`}
              value={rank.progress ?? 0}
              valueLabel={rank.progressLabel}
            />
          ))}
        </AutoGrid>
      </Section>
    </>
  )
}

function CommanderProgress({ ranks }: { ranks: CommanderViewModel['ranks'] }) {
  return (
    <DataTable className="commander-progress" density="compact" label="Commander career ranks" narrow="priority" scheme="surface">
      <thead><tr><th>Discipline</th><th>Reported level</th><th>Progress</th></tr></thead>
      <tbody>
        {ranks.map(rank => (
          <tr key={rank.id}>
            <th scope="row">{rank.label}</th>
            <td>{rank.level}</td>
            <td>
              <Meter className="commander-rank-meter" label={`${rank.label} progress`} layout="inline" value={rank.progress ?? 0} valueLabel={rank.progressLabel} />
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
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
