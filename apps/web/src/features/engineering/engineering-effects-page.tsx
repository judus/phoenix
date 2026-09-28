import { useState, type FormEvent } from 'react'
import type { EngineeringExperimentalEffect, EngineeringProject } from '@phoenix/contracts'
import { Button, DataTable, DataTableGroup, Field, Form, FormActions, FormGrid, PageFrame, Section, Select, Stack, Status, TextInput } from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import type { EngineeringControllerActions } from './use-engineering-controller.js'
import { EngineeringHeader } from './engineering-header.js'
import { engineeringProjectRoutes } from './engineering-navigation.js'

export function EngineeringEffectsPage({ effects, selectedSymbol, projects, actions, onNavigate }: {
  effects: EngineeringExperimentalEffect[], selectedSymbol?: string, projects: EngineeringProject[],
  actions?: EngineeringControllerActions, onNavigate(route: PhoenixRoute): void
}) {
  const [filter, setFilter] = useState('')
  const selected = effects.find(effect => effect.symbol === selectedSymbol)
  const shown = effects.filter(effect => (effect.name + ' ' + effect.modules.map(module => module.name).join(' ')).toLowerCase().includes(filter.toLowerCase()))
  if (selected) return <EffectDetail key={selected.symbol} effect={selected} projects={projects} actions={actions} onNavigate={onNavigate} />
  return <PageFrame layout="fit"><Stack fill gap="sm">
    <EngineeringHeader title="Experimental effects" trail={[{ label: 'Experimental effects' }]} />
    {selectedSymbol && <Status tone="warning">This effect is unavailable in the current recipe catalogue.</Status>}
    <Field label="Filter effects or modules" htmlFor="effect-filter"><TextInput id="effect-filter" value={filter} onChange={event => setFilter(event.target.value)} /></Field>
    <Stack className="engineering-scroll-content" gap="sm">
      {effects.length === 0 ? <Status tone="muted" wrap>No experimental recipes available. Refresh the catalogue and restart PHOENIX.</Status>
        : <DataTableGroup title="Experimental effects" meta={String(shown.length)}>
          <DataTable density="compact" label="Experimental effects" minimum="wide" narrow="scroll" scheme="surface">
            <thead><tr><th>Effect</th><th>Compatible modules</th><th>Materials per application</th></tr></thead>
            <tbody>{shown.map(effect => <tr key={effect.symbol}>
              <td className="wrap"><a href={`#/engineering/experimental-effects?symbol=${encodeURIComponent(effect.symbol)}`}>{effect.name}</a></td>
              <td className="wrap">{effect.modules.map(module => module.name).join(', ')}</td>
              <td className="wrap">{effect.components.map(component => `${component.cost} × ${component.name}`).join(', ')}</td>
            </tr>)}</tbody>
          </DataTable>
          {shown.length === 0 && <Status tone="muted">No matching effects.</Status>}
        </DataTableGroup>}
    </Stack>
  </Stack></PageFrame>
}

function EffectDetail({ effect, projects, actions, onNavigate }: {
  effect: EngineeringExperimentalEffect, projects: EngineeringProject[],
  actions?: EngineeringControllerActions, onNavigate(route: PhoenixRoute): void
}) {
  const active = projects.filter(project => project.status === 'active')
  const [projectId, setProjectId] = useState(active[0]?.id ?? '')
  const [moduleId, setModuleId] = useState(effect.modules[0]?.id ?? '')
  const [count, setCount] = useState('1')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const selectedProject = active.some(project => project.id === projectId) ? projectId : active[0]?.id ?? ''
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const applications = Number(count)
    if (!count.trim() || !Number.isInteger(applications) || applications < 1 || applications > 100) {
      setError('Applications must be a whole number between 1 and 100.')
      return
    }
    if (!actions || !selectedProject || saving) return
    setSaving(true); setError(undefined)
    void actions.addStep(selectedProject, { kind: 'experimental', effectSymbol: effect.symbol, moduleId, applications, note: null })
      .then(() => onNavigate(engineeringProjectRoutes.detail(selectedProject)))
      .catch(cause => { setError(cause instanceof Error ? cause.message : 'Effect could not be added.'); setSaving(false) })
  }
  return <PageFrame><Stack gap="sm">
    <EngineeringHeader title={effect.name} trail={[{ label: 'Experimental effects', href: '#/engineering/experimental-effects' }, { label: effect.name }]} />
    {effect.description && <p>{effect.description}</p>}
    <DataTableGroup title="Materials per application">
      <DataTable density="compact" label="Experimental effect materials" narrow="priority" scheme="surface">
        <thead><tr><th>Material</th><th>Cost</th><th>Owned</th></tr></thead>
        <tbody>{effect.components.map(component => <tr key={component.id}><td>{component.name}</td><td>{component.cost}</td><td>{component.count}</td></tr>)}</tbody>
      </DataTable>
    </DataTableGroup>
    {active.length ? <Section title="Add to project"><Form onSubmit={submit}>
      <FormGrid>
        <Field label="Project" htmlFor="effect-project"><Select id="effect-project" value={selectedProject} onChange={event => setProjectId(event.target.value)}>{active.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</Select></Field>
        <Field label="Module type" htmlFor="effect-module"><Select id="effect-module" value={moduleId} onChange={event => setModuleId(event.target.value)}>{effect.modules.map(module => <option key={module.id} value={module.id}>{module.name}</option>)}</Select></Field>
        <Field label="Applications" htmlFor="effect-count" hint="One application per module." required><TextInput id="effect-count" inputMode="numeric" type="number" required min={1} max={100} step={1} value={count} onChange={event => setCount(event.target.value)} /></Field>
      </FormGrid>
      <FormActions message={error ? <Status tone="danger" wrap>{error}</Status> : undefined}>
        <Button variant="primary" disabled={!actions || !selectedProject} busy={saving}>Add effect</Button>
      </FormActions>
    </Form></Section> : <Section title="Project required"><Stack gap="sm">
      <Status tone="muted">Create an active project to plan this effect.</Status>
      <div><Button onClick={() => onNavigate(engineeringProjectRoutes.new())}>New project</Button></div>
    </Stack></Section>}
  </Stack></PageFrame>
}
