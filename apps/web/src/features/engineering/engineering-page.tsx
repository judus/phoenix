import { useMemo, type ReactNode } from 'react'
import type {
  EngineeringBlueprintDetail,
  EngineeringBlueprintSummary,
  EngineeringEngineer,
  EngineeringMaterial
} from '@phoenix/contracts'
import {
  Breadcrumbs,
  DataTable,
  DataTableGroup,
  DescriptionItem,
  DescriptionList,
  Meter,
  PageFrame,
  PageHeader,
  Stack,
  Status,
  ThirdsGrid
} from '@phoenix/ui'
import { SystemLocationLink } from '../../components/system-location-link.js'
import type { EngineeringControllerSnapshot, EngineeringView } from './use-engineering-controller.js'

export function EngineeringPage({ controller, selectedBlueprintSymbol, view }: {
  controller: EngineeringControllerSnapshot
  selectedBlueprintSymbol?: string
  view: EngineeringView
}) {
  const title = pageTitle(view)
  if (controller.status === 'idle' || controller.status === 'loading') return <EngineeringState title={title} />
  if (controller.status === 'error') return <EngineeringState error={controller.error ?? 'Engineering data unavailable.'} title={title} />
  if (view === 'engineers') return <Engineers engineers={controller.engineers?.engineers ?? []} />
  if (view.startsWith('materials-')) return <Materials materials={controller.materials?.materials ?? []} updatedAt={controller.materials?.updatedAt} view={view} />
  if (selectedBlueprintSymbol) {
    return controller.blueprint
      ? <BlueprintDetail blueprint={controller.blueprint} />
      : <EngineeringState error="Engineering blueprint unavailable." title="Blueprint" />
  }
  return <Blueprints blueprints={controller.blueprints?.blueprints ?? []} />
}

function EngineeringState({ error, title }: { error?: string, title: string }) {
  return (
    <PageFrame aria-busy={!error}>
      <Stack gap="xl">
        <EngineeringHeader title={title} />
        <Status tone={error ? 'danger' : 'muted'}>{error ?? 'Loading engineering records…'}</Status>
      </Stack>
    </PageFrame>
  )
}

function Engineers({ engineers }: { engineers: EngineeringEngineer[] }) {
  return (
    <PageFrame>
      <Stack gap="xl">
        <EngineeringHeader title="Engineers" />
        <EngineerGroup engineers={engineers.filter(engineer => engineer.state === 'unlocked')} title="Unlocked engineers" />
        <EngineerGroup engineers={engineers.filter(engineer => engineer.state === 'known')} title="Known / invited engineers" />
        <EngineerGroup engineers={engineers.filter(engineer => engineer.state === 'locked')} title="Locked engineers" />
      </Stack>
    </PageFrame>
  )
}

function EngineerGroup({ engineers, title }: { engineers: EngineeringEngineer[], title: string }) {
  return (
    <DataTableGroup meta={`${engineers.length} engineers`} title={title}>
      {engineers.length > 0 ? <EngineerTable engineers={engineers} /> : <div><Status tone="muted">None</Status></div>}
    </DataTableGroup>
  )
}

function EngineerTable({ engineers }: { engineers: EngineeringEngineer[] }) {
  return (
    <DataTable density="compact" label="Engineers" minimum="wide" narrow="priority" scheme="surface">
      <thead><tr><th>Engineer</th><th>Specialisation</th><th>Status</th><th>Location</th></tr></thead>
      <tbody>{engineers.map(engineer => (
        <tr className={engineer.state === 'locked' ? 'disabled' : undefined} key={engineer.id}>
          <td><strong>{engineer.name}</strong></td>
          <td>{engineer.description}</td>
          <td>{engineer.progress.rank > 0
            ? <>Grade {engineer.progress.rank}<small>{formatProgress(engineer.progress.rankProgress)}</small></>
            : engineer.progress.status ?? 'Locked'}</td>
          <td><SystemLocationLink systemName={engineer.system.name} />{engineer.distanceLy !== null ? <small>{engineer.distanceLy.toFixed(0)} LY</small> : null}</td>
        </tr>
      ))}</tbody>
    </DataTable>
  )
}

function Materials({ materials, updatedAt, view }: { materials: EngineeringMaterial[], updatedAt?: string | null, view: EngineeringView }) {
  const groups = useMemo(() => groupBy(materials, material => material.group), [materials])
  return (
    <PageFrame>
      <Stack gap="xl">
        <EngineeringHeader status={updatedAt ? `Observed ${formatDateTime(updatedAt)}` : undefined} title={pageTitle(view)} />
        {materials.length === 0
          ? <Status tone="muted">No materials found.</Status>
          : [...groups.entries()].map(([group, entries]) => <MaterialGroup entries={entries} group={group} key={group} />)}
      </Stack>
    </PageFrame>
  )
}

function MaterialGroup({ entries, group }: { entries: EngineeringMaterial[], group: string }) {
  return (
    <DataTableGroup meta={`${entries.length} materials`} title={group}>
      <DataTable density="compact" label={`${group} materials`} minimum="wide" narrow="priority" scheme="surface">
        <thead><tr><th>Material</th><th>Inventory</th><th>Applications</th><th>Grade</th></tr></thead>
        <tbody>{entries.map(material => (
          <tr className={material.count === 0 ? 'disabled' : material.count === material.maxCount ? 'engineered-max' : undefined} key={material.id}>
            <td><strong>{material.name}</strong><small>{material.rarity}</small></td>
            <td><Meter label={`${material.name} inventory`} layout="compact" max={material.maxCount} value={material.count} valueLabel={`${material.count} / ${material.maxCount}`} /></td>
            <td>{material.blueprintUses.length > 0 ? unique(material.blueprintUses.map(use => use.name)).join(', ') : material.category === 'xeno' ? 'Classified' : '—'}</td>
            <td>G{material.grade}</td>
          </tr>
        ))}</tbody>
      </DataTable>
    </DataTableGroup>
  )
}

function Blueprints({ blueprints }: { blueprints: EngineeringBlueprintSummary[] }) {
  return (
    <PageFrame>
      <Stack gap="xl">
        <EngineeringHeader title="Blueprints" />
        <BlueprintGroup blueprints={blueprints} title="Blueprints" />
      </Stack>
    </PageFrame>
  )
}

function BlueprintGroup({ blueprints, title }: { blueprints: EngineeringBlueprintSummary[], title: string }) {
  return (
    <DataTableGroup meta={`${blueprints.length} modifications`} title={title}>
      {blueprints.length > 0
        ? <DataTable density="compact" label={title} minimum="wide" narrow="priority" scheme="surface">
            <thead><tr><th>Modification</th><th>Modules</th></tr></thead>
            <tbody>{blueprints.map(blueprint => (
              <tr key={blueprint.symbol}>
                <td><a href={`#/engineering/blueprints?symbol=${encodeURIComponent(blueprint.symbol)}`}><strong>{blueprint.name}</strong></a><small>{blueprint.originalName}</small></td>
                <td>{blueprint.moduleNames.join(', ')}</td>
              </tr>
            ))}</tbody>
          </DataTable>
        : <div><Status tone="muted">No blueprints found.</Status></div>}
    </DataTableGroup>
  )
}

function BlueprintDetail({ blueprint }: { blueprint: EngineeringBlueprintDetail }) {
  return (
    <PageFrame>
      <Stack gap="xl">
        <EngineeringHeader blueprint={blueprint} title={blueprint.name} />
        <a href="#/engineering/blueprints">← All blueprints</a>
        <DataTableGroup title="Engineered equipment">
          {blueprint.appliedModules.length > 0
            ? <DataTable density="compact" label="Engineered equipment" narrow="priority" scheme="surface"><tbody>{blueprint.appliedModules.map(module => (
                <tr key={module.slotId}><td><strong>{module.name}</strong><small>{module.slotId}</small></td><td>Grade {module.grade ?? '—'}</td><td>{module.experimentalEffect ?? '—'}</td></tr>
              ))}</tbody></DataTable>
            : <div><Status tone="muted">Not applied to equipment on the current ship.</Status></div>}
        </DataTableGroup>
        <BlueprintEngineers blueprint={blueprint} />
        {blueprint.grades.map(grade => (
          <DataTableGroup key={grade.grade} title={`Grade ${grade.grade}`}>
            <ThirdsGrid gap="lg">
              <DescriptionList columns="one" density="compact">
                {grade.features.map(feature => <DescriptionItem key={feature.name} label={`${feature.improvement ? '▲' : '▼'} ${feature.name}`} value={formatFeatureValues(feature.values)} />)}
              </DescriptionList>
              <div className="span-two">
                <DataTable density="compact" label={`Grade ${grade.grade} components`} narrow="priority" scheme="surface">
                  <thead><tr><th>Material</th><th>Cost</th><th>Inventory</th></tr></thead>
                  <tbody>{grade.components.map(component => (
                    <tr className={component.count < component.cost ? 'disabled' : undefined} key={component.id}>
                      <td><strong>{component.name}</strong><small>{component.category ?? 'Unknown'}{component.grade ? ` · G${component.grade}` : ''}</small></td>
                      <td>{component.cost}</td><td>{component.count}</td>
                    </tr>
                  ))}</tbody>
                </DataTable>
              </div>
            </ThirdsGrid>
          </DataTableGroup>
        ))}
      </Stack>
    </PageFrame>
  )
}

function BlueprintEngineers({ blueprint }: { blueprint: EngineeringBlueprintDetail }) {
  return (
    <DataTableGroup title="Engineers">
      <DataTable density="compact" label="Capable engineers" minimum="wide" narrow="priority" scheme="surface">
        <thead><tr><th>Engineer</th><th>Capability</th><th>Access</th><th>Location</th></tr></thead>
        <tbody>{blueprint.engineers.map(engineer => (
          <tr className={engineer.rank === 0 ? 'disabled' : undefined} key={engineer.name}>
            <td><strong>{engineer.name}</strong></td><td>{gradeRange(engineer.grades)}</td>
            <td>{engineer.rank > 0 ? `Grade ${engineer.rank} unlocked` : engineer.status ?? 'Locked'}</td>
            <td>{engineer.systemName ? <><SystemLocationLink systemName={engineer.systemName} />{engineer.distanceLy !== null ? <small>{engineer.distanceLy.toFixed(0)} LY</small> : null}</> : '—'}</td>
          </tr>
        ))}</tbody>
      </DataTable>
    </DataTableGroup>
  )
}

function EngineeringHeader({ blueprint, status, title }: { blueprint?: EngineeringBlueprintDetail, status?: ReactNode, title: string }) {
  const items = blueprint
    ? [{ label: 'Engineering', href: '#/engineering/blueprints' }, { label: 'Blueprints', href: '#/engineering/blueprints' }, { label: title }]
    : [{ label: 'Engineering', href: '#/engineering/blueprints' }, { label: title }]
  return <PageHeader variant="cockpit" context={<Breadcrumbs items={title === 'Blueprints' ? [{ label: 'Engineering' }, { label: 'Blueprints' }] : items} />} status={status} title={title} />
}

function pageTitle(view: EngineeringView): string {
  if (view === 'blueprints') return 'Blueprints'
  if (view === 'engineers') return 'Engineers'
  return `${capitalize(view.slice('materials-'.length))} materials`
}

function groupBy<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const value of values) groups.set(key(value), [...(groups.get(key(value)) ?? []), value])
  return groups
}

function unique<T>(values: T[]): T[] { return [...new Set(values)] }
function capitalize(value: string): string { return value.charAt(0).toLocaleUpperCase() + value.slice(1) }
function formatProgress(progress: number): string { return progress > 0 ? `${progress.toFixed(0)}%` : 'Rank progress not observed' }
function gradeRange(grades: number[]): string { const minimum = Math.min(...grades); const maximum = Math.max(...grades); return minimum === maximum ? `Grade ${minimum}` : `Grades ${minimum}–${maximum}` }
function formatFeatureValues(values: number[]): string { return values.length === 0 ? '—' : values.map(value => `${value >= 0 ? '+' : ''}${value}`).join(' — ') }
function formatDateTime(value: string): string { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
