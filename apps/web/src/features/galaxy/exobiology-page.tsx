import { useState, type ReactNode } from 'react'
import {
  Breadcrumbs,
  DataTable,
  DataTableGroup,
  PageFrame,
  PageHeader,
  Stack,
  Status,
  ThirdsGrid
} from '@phoenix/ui'
import type { GalaxyControllerSnapshot } from './use-galaxy-controller.js'
import {
  createExobiologyViewModel,
  type ExobiologyBodyViewModel,
  type ExobiologySampleViewModel,
  type ExobiologySystemViewModel
} from './exobiology-view-model.js'
import { SystemSchematicLink } from '../../components/system-location-link.js'
import { PhoenixDateTime, UpdatedDateTime } from '../../components/phoenix-date-time.js'

export function ExobiologyPage({ controller }: { controller: GalaxyControllerSnapshot }) {
  const [selectedSystemId, setSelectedSystemId] = useState<string>()
  const [selectedBodyId, setSelectedBodyId] = useState<string>()
  const [selectedSampleId, setSelectedSampleId] = useState<string>()

  if (controller.status === 'idle' || controller.status === 'loading') return <ExobiologyState />
  if (controller.status === 'error' || !controller.exploration) {
    return <ExobiologyState error={controller.error ?? 'Exobiology records unavailable.'} />
  }

  const model = createExobiologyViewModel(controller.exploration)
  const system = model.systems.find(candidate => candidate.id === selectedSystemId) ?? model.systems[0]
  const body = system?.bodies.find(candidate => candidate.id === selectedBodyId) ?? system?.bodies[0]
  const sample = body?.samples.find(candidate => candidate.id === selectedSampleId) ?? body?.samples[0]

  return (
    <PageFrame layout="fit">
      <Stack className="exobiology-page" fill gap="sm">
        <ExobiologyHeader updatedAt={model.updatedAt} />
        {model.systems.length === 0
          ? <Status tone="muted">No biological signals or organic samples have been recorded in the local journal.</Status>
          : (
              <ThirdsGrid fill gap="sm">
                <ExobiologySystems
                  completed={model.completed}
                  onSelect={id => {
                    setSelectedSystemId(id)
                    setSelectedBodyId(undefined)
                    setSelectedSampleId(undefined)
                  }}
                  selectedId={system?.id}
                  systems={model.systems}
                  total={model.total}
                />
                <ExobiologyBodies
                  bodies={system?.bodies ?? []}
                  onSelect={id => {
                    setSelectedBodyId(id)
                    setSelectedSampleId(undefined)
                  }}
                  selectedId={body?.id}
                />
                <ExobiologySamples
                  onSelect={setSelectedSampleId}
                  samples={body?.samples ?? []}
                  selectedId={sample?.id}
                />
              </ThirdsGrid>
            )}
      </Stack>
    </PageFrame>
  )
}

function ExobiologyState({ error }: { error?: string }) {
  return (
    <PageFrame aria-busy={!error}>
      <Stack gap="xl">
        <ExobiologyHeader />
        <Status tone={error ? 'danger' : 'muted'}>{error ?? 'Reconstructing journal-backed exobiology records…'}</Status>
      </Stack>
    </PageFrame>
  )
}

function ExobiologyHeader({ updatedAt }: { updatedAt?: string | null }) {
  return <PageHeader
    variant="cockpit"
    context={<Breadcrumbs items={[{ label: 'Galaxy', href: '#/galaxy/system' }, { label: 'Exobiology' }]} />}
    status={updatedAt ? <UpdatedDateTime value={updatedAt} /> : undefined}
    title="Exobiology"
  />
}

function ExobiologySystems({ completed, onSelect, selectedId, systems, total }: {
  completed: number
  onSelect(id: string): void
  selectedId?: string
  systems: ExobiologySystemViewModel[]
  total: number
}) {
  return (
    <DataTableGroup fill meta={`${completed}/${total} complete`} title="Systems">
      <DataTable className="exobiology-index-table" density="compact" label="Systems with biological records" narrow="priority" scheme="surface" stickyHeader>
        <thead><tr><th>System</th><th aria-label="Progress" className="numeric" /></tr></thead>
        <tbody>{systems.map(system => (
          <SelectableRow active={system.id === selectedId} id={system.id} key={system.id} onSelect={onSelect}>
            <td className="exobiology-name exobiology-name-end"><SystemSchematicLink label={system.name} systemName={system.name} /><small><PhoenixDateTime value={system.updatedAt} /></small></td>
            <td className="numeric">{system.completed}/{system.total}</td>
          </SelectableRow>
        ))}</tbody>
      </DataTable>
    </DataTableGroup>
  )
}

function ExobiologyBodies({ bodies, onSelect, selectedId }: {
  bodies: ExobiologyBodyViewModel[]
  onSelect(id: string): void
  selectedId?: string
}) {
  return (
    <DataTableGroup fill meta={`${bodies.length} recorded`} title="Bodies">
      <DataTable className="exobiology-index-table" density="compact" label="Bodies with biological records" narrow="priority" scheme="surface" stickyHeader>
        <thead><tr><th>Body</th><th aria-label="Progress" className="numeric" /></tr></thead>
        <tbody>{bodies.map(body => (
          <SelectableRow active={body.id === selectedId} id={body.id} key={body.id} onSelect={onSelect}>
            <td className="exobiology-name exobiology-name-start"><SystemSchematicLink label={body.name} selectedName={body.name} systemName={body.systemName} /><small><PhoenixDateTime value={body.observedAt} /></small></td>
            <td className="numeric">{body.completed}/{body.total}</td>
          </SelectableRow>
        ))}</tbody>
      </DataTable>
    </DataTableGroup>
  )
}

function ExobiologySamples({ onSelect, samples, selectedId }: {
  onSelect(id: string): void
  samples: ExobiologySampleViewModel[]
  selectedId?: string
}) {
  return (
    <DataTableGroup fill meta={`${samples.filter(sample => sample.completed).length}/${samples.length} complete`} title="Samples">
      <DataTable className="exobiology-index-table" density="compact" label="Organic sample progress" narrow="priority" scheme="surface" stickyHeader>
        <thead><tr><th>Organism</th><th className="numeric">Scans</th></tr></thead>
        <tbody>{samples.map(sample => (
          <SelectableRow active={sample.id === selectedId} id={sample.id} key={sample.id} onSelect={onSelect}>
            <td>
              <strong>{sample.species === 'Unknown' ? sample.genus : sample.species}</strong>
              <small>{sample.variant === 'Unknown' ? sample.genus : `${sample.genus} · ${sample.variant}`}</small>
            </td>
            <td className="numeric">{sample.progress}/3</td>
          </SelectableRow>
        ))}</tbody>
      </DataTable>
    </DataTableGroup>
  )
}

function SelectableRow({ active, children, id, onSelect }: {
  active: boolean
  children: ReactNode
  id: string
  onSelect(id: string): void
}) {
  return (
    <tr
      aria-selected={active || undefined}
      className={active ? 'active' : undefined}
      onClick={event => {
        if (isInteractiveTarget(event.target)) return
        onSelect(id)
      }}
      onKeyDown={event => {
        if (isInteractiveTarget(event.target)) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect(id)
      }}
      tabIndex={0}
    >{children}</tr>
  )
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('a, button') !== null
}
