import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  EngineeringBlueprintDetail,
  EngineeringBlueprintSummary,
  EngineeringEngineer,
  EngineeringMaterial,
  HealthResponse,
  RuntimeState
} from '@phoenix/contracts'
import type { PhoenixApi } from '../api/phoenix-api-client.js'
import { Page, PageContent, PageHeader } from '../components/layout/page.js'
import { PhoenixShell } from '../components/layout/phoenix-shell.js'
import type { NavigationItem } from '../components/navigation/navigation.js'

export type EngineeringView =
  | { type: 'blueprints', symbol?: string }
  | { type: 'engineers' }
  | { type: 'materials', category: EngineeringMaterial['category'] }

const navigation: NavigationItem[] = [
  { href: '#/engineering/blueprints', icon: '⌘', id: 'blueprints', label: 'Blueprints' },
  { href: '#/engineering/engineers', icon: '♙', id: 'engineers', label: 'Engineers' },
  { href: '#/engineering/materials/raw', icon: '△', id: 'raw', label: 'Raw materials' },
  { href: '#/engineering/materials/manufactured', icon: '⬡', id: 'manufactured', label: 'Manufactured materials' },
  { href: '#/engineering/materials/encoded', icon: '⌁', id: 'encoded', label: 'Encoded materials' },
  { href: '#/engineering/materials/xeno', icon: '◇', id: 'xeno', label: 'Xeno materials' }
]

export interface EngineeringPageProps {
  api: PhoenixApi
  error?: string
  health?: HealthResponse
  runtimeState?: RuntimeState
  view: EngineeringView
}

export function EngineeringPage ({ api, error, health, runtimeState, view }: EngineeringPageProps) {
  const [engineers, setEngineers] = useState<EngineeringEngineer[]>()
  const [materials, setMaterials] = useState<EngineeringMaterial[]>()
  const [blueprints, setBlueprints] = useState<EngineeringBlueprintSummary[]>()
  const [blueprint, setBlueprint] = useState<EngineeringBlueprintDetail>()
  const [engineeringError, setEngineeringError] = useState<string>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    setEngineeringError(undefined)
    const request = view.type === 'engineers'
      ? api.getEngineeringEngineers().then(result => { if (active) setEngineers(result.engineers) })
      : view.type === 'materials'
        ? api.getEngineeringMaterials(view.category).then(result => { if (active) setMaterials(result.materials) })
        : view.symbol
          ? api.getEngineeringBlueprint(view.symbol).then(result => { if (active) setBlueprint(result) })
          : api.getEngineeringBlueprints().then(result => { if (active) setBlueprints(result.blueprints) })
    void request.catch(cause => {
      if (active) setEngineeringError(cause instanceof Error ? cause.message : 'Engineering data unavailable.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [api, runtimeState?.revision, view.type, view.type === 'materials' ? view.category : undefined, view.type === 'blueprints' ? view.symbol : undefined])

  const page = engineeringPageIdentity(view, blueprint)

  return (
    <PhoenixShell
      activePrimaryItemId="engineering"
      activeSecondaryItemId={page.navigationId}
      error={error ?? engineeringError}
      health={health}
      secondaryNavigation={navigation}
    >
      <Page className="engineering-page">
        <PageHeader title={page.title} eyebrow={page.eyebrow} description={page.description} />
        <PageContent>
          {loading
            ? <p className="engineering-empty">Loading engineering records…</p>
            : engineeringError
              ? <p className="engineering-empty">{engineeringError}</p>
              : view.type === 'engineers'
                ? <EngineersView engineers={engineers ?? []} />
                : view.type === 'materials'
                  ? <MaterialsView materials={materials ?? []} />
                  : view.symbol
                    ? blueprint && <BlueprintDetailView blueprint={blueprint} />
                    : <BlueprintsView blueprints={blueprints ?? []} />}
        </PageContent>
      </Page>
    </PhoenixShell>
  )
}

function EngineersView ({ engineers }: { engineers: EngineeringEngineer[] }) {
  return (
    <div className="engineering-sections">
      <EngineeringSection title="Unlocked engineers">
        <EngineerTable engineers={engineers.filter(engineer => engineer.state === 'unlocked')} />
      </EngineeringSection>
      <EngineeringSection title="Known / invited engineers">
        <EngineerTable engineers={engineers.filter(engineer => engineer.state === 'known')} />
      </EngineeringSection>
      <EngineeringSection title="Locked engineers">
        <EngineerTable engineers={engineers.filter(engineer => engineer.state === 'locked')} />
      </EngineeringSection>
    </div>
  )
}

function EngineerTable ({ engineers }: { engineers: EngineeringEngineer[] }) {
  if (engineers.length === 0) return <p className="engineering-empty">None</p>
  return (
    <table className="data-table engineering-engineers">
      <thead><tr><th>Engineer</th><th>Specialisation</th><th>Status</th><th>Location</th></tr></thead>
      <tbody>
        {engineers.map(engineer => (
          <tr key={engineer.id} className={engineer.state === 'locked' ? 'is-muted' : undefined}>
            <td><strong>{engineer.name}</strong></td>
            <td>{engineer.description}</td>
            <td>
              {engineer.progress.rank > 0
                ? <>Grade {engineer.progress.rank} <small>{formatProgress(engineer.progress.rankProgress)}</small></>
                : engineer.progress.status ?? 'Locked'}
            </td>
            <td className="align-right">
              <a href={systemHref(engineer.system.name)}>{engineer.system.name}</a>
              {engineer.distanceLy !== null && <small>{engineer.distanceLy.toFixed(0)} Ly</small>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MaterialsView ({ materials }: { materials: EngineeringMaterial[] }) {
  const groups = useMemo(() => groupBy(materials, material => material.group), [materials])
  if (materials.length === 0) return <p className="engineering-empty">No materials found.</p>
  return (
    <div className="engineering-sections">
      {[...groups.entries()].map(([group, entries]) => (
        <EngineeringSection key={group} title={group}>
          <table className="data-table engineering-materials">
            <thead><tr><th>Material</th><th>Inventory</th><th>Applications</th><th>Grade</th></tr></thead>
            <tbody>
              {entries.map(material => (
                <tr key={material.id} className={material.count === 0 ? 'is-muted' : material.count === material.maxCount ? 'is-full' : undefined}>
                  <td><strong>{material.name}</strong><small>{material.rarity}</small></td>
                  <td>
                    <span>{material.count}<small> / {material.maxCount}</small></span>
                    <progress value={material.count} max={material.maxCount} />
                  </td>
                  <td>{material.blueprintUses.length > 0
                    ? unique(material.blueprintUses.map(use => use.name)).join(', ')
                    : material.category === 'xeno' ? 'Classified' : '—'}</td>
                  <td className="align-right"><span className="engineering-grade">G{material.grade}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </EngineeringSection>
      ))}
    </div>
  )
}

function BlueprintsView ({ blueprints }: { blueprints: EngineeringBlueprintSummary[] }) {
  const applied = blueprints.filter(blueprint => blueprint.appliedModuleCount > 0)
  const other = blueprints.filter(blueprint => blueprint.appliedModuleCount === 0)
  return (
    <div className="engineering-sections">
      {applied.length > 0 && <EngineeringSection title="Applied blueprints"><BlueprintTable blueprints={applied} /></EngineeringSection>}
      <EngineeringSection title={applied.length > 0 ? 'Other blueprints' : 'Blueprints'}>
        <BlueprintTable blueprints={other} />
      </EngineeringSection>
    </div>
  )
}

function BlueprintTable ({ blueprints }: { blueprints: EngineeringBlueprintSummary[] }) {
  return (
    <table className="data-table engineering-blueprints">
      <thead><tr><th>Modification</th><th>Modules</th><th>Current ship</th><th /></tr></thead>
      <tbody>
        {blueprints.map(blueprint => (
          <tr key={blueprint.symbol} className={blueprint.appliedModuleCount > 0 ? 'is-highlighted' : undefined}>
            <td><a href={`#/engineering/blueprints?symbol=${encodeURIComponent(blueprint.symbol)}`}><strong>{blueprint.name}</strong></a><small>{blueprint.originalName}</small></td>
            <td>{blueprint.moduleNames.join(', ')}</td>
            <td>{blueprint.appliedModuleCount > 0 ? `${blueprint.appliedModuleCount} fitted` : '—'}</td>
            <td className="align-right">›</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function BlueprintDetailView ({ blueprint }: { blueprint: EngineeringBlueprintDetail }) {
  return (
    <div className="engineering-sections engineering-blueprint-detail">
      <p><a href="#/engineering/blueprints">← All blueprints</a></p>
      <EngineeringSection title="Engineered equipment">
        {blueprint.appliedModules.length === 0
          ? <p className="engineering-empty">Not applied to equipment on the current ship.</p>
          : <table className="data-table"><tbody>{blueprint.appliedModules.map(module => (
              <tr key={module.slotId}><td><strong>{module.name}</strong><small>{module.slotId}</small></td><td>Grade {module.grade ?? '—'}</td><td>{module.experimentalEffect ?? '—'}</td></tr>
            ))}</tbody></table>}
      </EngineeringSection>
      <EngineeringSection title="Engineers">
        <table className="data-table"><thead><tr><th>Engineer</th><th>Capability</th><th>Access</th><th>Location</th></tr></thead><tbody>
          {blueprint.engineers.map(engineer => (
            <tr key={engineer.name} className={engineer.rank === 0 ? 'is-muted' : undefined}>
              <td><strong>{engineer.name}</strong></td>
              <td>{gradeRange(engineer.grades)}</td>
              <td>{engineer.rank > 0 ? `Grade ${engineer.rank} unlocked` : engineer.status ?? 'Locked'}</td>
              <td className="align-right">{engineer.systemName
                ? <><a href={systemHref(engineer.systemName)}>{engineer.systemName}</a>{engineer.distanceLy !== null && <small>{engineer.distanceLy.toFixed(0)} Ly</small>}</>
                : '—'}</td>
            </tr>
          ))}
        </tbody></table>
      </EngineeringSection>
      {blueprint.grades.map(grade => (
        <EngineeringSection key={grade.grade} title={`Grade ${grade.grade}`}>
          <div className="engineering-grade-layout">
            <div className="engineering-features">
              {grade.features.map(feature => (
                <p key={feature.name} className={feature.improvement ? 'is-positive' : 'is-negative'}>
                  <span>{feature.improvement ? '▲' : '▼'} {feature.name}</span>
                  <span>{formatFeatureValues(feature.values)}</span>
                </p>
              ))}
            </div>
            <table className="data-table engineering-components">
              <thead><tr><th>Material</th><th>Cost</th><th>Inventory</th></tr></thead>
              <tbody>{grade.components.map(component => (
                <tr key={component.name} className={component.count < component.cost ? 'is-muted' : undefined}>
                  <td><strong>{component.name}</strong><small>{component.category ?? 'Unknown'}{component.grade ? ` · G${component.grade}` : ''}</small></td>
                  <td>{component.cost}</td><td>{component.count}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </EngineeringSection>
      ))}
    </div>
  )
}

function EngineeringSection ({ children, title }: { children: ReactNode, title: string }) {
  return <section className="content-section"><h2 className="section-heading">{title}</h2>{children}</section>
}

function engineeringPageIdentity (view: EngineeringView, blueprint?: EngineeringBlueprintDetail) {
  if (view.type === 'engineers') return { navigationId: 'engineers', title: 'Engineers', eyebrow: 'Engineers & workshops', description: 'Access, rank, specialisation, and workshop locations.' }
  if (view.type === 'materials') {
    const title = `${capitalize(view.category)} Materials`
    return { navigationId: view.category, title, eyebrow: view.category === 'xeno' ? 'Guardian and Thargoid technology' : 'Engineering inventory', description: view.category === 'xeno' ? 'Alien technology used in synthesis and Technology Broker unlocks.' : 'Current inventory, capacity, grade, and known blueprint applications.' }
  }
  return { navigationId: 'blueprints', title: blueprint?.name ?? 'Blueprints', eyebrow: blueprint?.originalName ?? 'Ship & equipment modifications', description: blueprint ? blueprint.moduleNames.join(', ') : 'Modifications, grades, material costs, capable engineers, and current applications.' }
}

function groupBy<T> (values: T[], key: (value: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const value of values) groups.set(key(value), [...(groups.get(key(value)) ?? []), value])
  return groups
}

function unique<T> (values: T[]): T[] { return [...new Set(values)] }
function capitalize (value: string): string { return value.charAt(0).toLocaleUpperCase() + value.slice(1) }
function systemHref (systemName: string): string { return `#/galaxy/system?name=${encodeURIComponent(systemName)}` }
function formatProgress (progress: number): string { return progress > 0 ? `· ${progress.toFixed(0)}%` : '' }
function gradeRange (grades: number[]): string { const minimum = Math.min(...grades); const maximum = Math.max(...grades); return minimum === maximum ? `Grade ${minimum}` : `Grades ${minimum}–${maximum}` }
function formatFeatureValues (values: number[]): string { return values.length === 0 ? '—' : values.map(value => `${value >= 0 ? '+' : ''}${value}`).join(' — ') }
