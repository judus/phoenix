import { useState, type FormEvent } from 'react'
import type { EngineeringMaterialWatchlistResponse, EngineeringProject, EngineeringProjectCreateRequest, EngineeringProjectUpdateRequest } from '@phoenix/contracts'
import {
  Button,
  DataTable,
  DataTableGroup,
  Field,
  Form,
  FormActions,
  FormGrid,
  PageFrame,
  PageHeader,
  Select,
  Stack,
  Status,
  Textarea,
  TextInput
} from '@phoenix/ui'
import type { EngineeringControllerActions } from './use-engineering-controller.js'

export function EngineeringProjectsPage({ actions, projects, watchlist }: {
  actions?: EngineeringControllerActions
  projects: EngineeringProject[]
  watchlist?: EngineeringMaterialWatchlistResponse
}) {
  const [error, setError] = useState<string>()
  const [creating, setCreating] = useState(false)
  const active = projects.filter(project => project.status === 'active')
  const inactive = projects.filter(project => project.status !== 'active')
  return (
    <PageFrame>
      <Stack gap="sm">
        <PageHeader
          variant="cockpit"
          context="Engineering · Projects"
          description="Plan blueprint rolls here. Material balances remain sourced from Elite telemetry."
          status={<Button size="sm" variant={creating ? 'quiet' : 'outline'} onClick={() => setCreating(value => !value)}>{creating ? 'Cancel' : 'New project'}</Button>}
          title="Engineering projects"
        />
        {error ? <Status tone="danger">{error}</Status> : null}
        {creating ? <CreateProjectForm actions={actions} onCreated={() => setCreating(false)} onError={setError} /> : null}
        <ProjectGroup actions={actions} projects={active} title="Active projects" onError={setError} />
        <MaterialPlan watchlist={watchlist} />
        {inactive.length > 0 ? <ProjectGroup actions={actions} projects={inactive} title="Paused and archived" onError={setError} /> : null}
      </Stack>
    </PageFrame>
  )
}

function CreateProjectForm({ actions, onCreated, onError }: { actions?: EngineeringControllerActions, onCreated(): void, onError(message?: string): void }) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [priority, setPriority] = useState<EngineeringProjectCreateRequest['priority']>('normal')
  const [saving, setSaving] = useState(false)
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (!actions || !name.trim()) return
    setSaving(true)
    onError(undefined)
    void actions.createProject({ name, note: note || null, priority })
      .then(() => { setName(''); setNote(''); setPriority('normal'); onCreated() })
      .catch(cause => onError(message(cause)))
      .finally(() => setSaving(false))
  }
  return (
    <DataTableGroup title="New project">
      <Form className="engineering-project-form" onSubmit={submit}>
        <FormGrid>
          <Field htmlFor="engineering-project-name" label="Project name" required>
            <TextInput id="engineering-project-name" maxLength={120} required value={name} onChange={event => setName(event.target.value)} />
          </Field>
          <Field htmlFor="engineering-project-priority" label="Priority">
            <Select id="engineering-project-priority" value={priority} onChange={event => setPriority(event.target.value as EngineeringProjectCreateRequest['priority'])}>
              <option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option>
            </Select>
          </Field>
        </FormGrid>
        <Field htmlFor="engineering-project-note" label="Note">
          <Textarea id="engineering-project-note" maxLength={1000} rows={2} value={note} onChange={event => setNote(event.target.value)} />
        </Field>
        <FormActions><Button busy={saving} disabled={!actions} variant="primary">Create project</Button></FormActions>
      </Form>
    </DataTableGroup>
  )
}

function ProjectGroup({ actions, onError, projects, title }: {
  actions?: EngineeringControllerActions
  onError(message?: string): void
  projects: EngineeringProject[]
  title: string
}) {
  return (
    <DataTableGroup meta={`${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`} title={title}>
      {projects.length === 0
        ? <Status tone="muted">No active engineering projects. Create one, then choose a blueprint.</Status>
        : <Stack gap="sm">{projects.map(project => <Project key={project.id} actions={actions} project={project} onError={onError} />)}</Stack>}
    </DataTableGroup>
  )
}

function MaterialPlan({ watchlist }: { watchlist?: EngineeringMaterialWatchlistResponse }) {
  if (!watchlist || watchlist.activeProjectCount === 0) return null
  return (
    <DataTableGroup meta={`${watchlist.materials.length} missing`} title="Active material plan">
      {watchlist.materials.length === 0
        ? <Status tone="positive">All planned blueprint materials are currently in inventory.</Status>
        : (
            <DataTable density="compact" label="Active engineering material plan" narrow="priority" scheme="surface">
              <thead><tr><th>Material</th><th>Stock</th><th>Required</th><th>Missing</th><th>Projects</th></tr></thead>
              <tbody>{watchlist.materials.map(material => (
                <tr key={material.materialId}>
                  <td><strong>{material.materialName}</strong><small>{material.category ?? 'Unknown'}{material.grade ? ` · G${material.grade}` : ''}</small></td>
                  <td>{material.owned}</td><td>{material.required}</td><td className="text-danger">{material.missing}</td>
                  <td className="wrap">{material.projects.map(project => project.name).join(', ')}</td>
                </tr>
              ))}</tbody>
            </DataTable>
          )}
    </DataTableGroup>
  )
}

function Project({ actions, onError, project }: {
  actions?: EngineeringControllerActions
  onError(message?: string): void
  project: EngineeringProject
}) {
  const update = (patch: Partial<EngineeringProjectUpdateRequest>): void => {
    if (!actions) return
    onError(undefined)
    void actions.updateProject(project.id, {
      name: project.name,
      note: project.note,
      priority: project.priority,
      status: project.status,
      ...patch
    }).catch(cause => onError(message(cause)))
  }
  return (
    <section className="engineering-project">
      <header>
        <div><strong>{project.name}</strong><small>{project.priority} priority · {project.status}</small></div>
        <div className="engineering-project-actions">
          <Select aria-label={`${project.name} priority`} value={project.priority} onChange={event => update({ priority: event.target.value as EngineeringProject['priority'] })}>
            <option value="high">High priority</option><option value="normal">Normal priority</option><option value="low">Low priority</option>
          </Select>
          <Button size="sm" variant="quiet" onClick={() => update({ status: project.status === 'active' ? 'paused' : 'active' })}>{project.status === 'active' ? 'Pause' : 'Activate'}</Button>
          {project.status !== 'completed' ? <Button size="sm" variant="quiet" onClick={() => update({ status: 'completed' })}>Complete</Button> : null}
          {project.status !== 'archived' ? <Button size="sm" variant="quiet" onClick={() => update({ status: 'archived' })}>Archive</Button> : null}
          <Button size="sm" variant="danger" onClick={() => actions && void actions.deleteProject(project.id).catch(cause => onError(message(cause)))}>Delete</Button>
        </div>
      </header>
      {project.note ? <p>{project.note}</p> : null}
      {project.steps.length === 0
        ? <Status tone="muted">No planned steps. Open a blueprint to add one.</Status>
        : (
            <DataTable density="compact" label={`${project.name} planned steps`} narrow="priority" scheme="surface">
              <thead><tr><th>Blueprint</th><th>Plan</th><th>Required materials</th><th aria-label="Actions" /></tr></thead>
              <tbody>{project.steps.map(step => (
                <tr key={step.id}>
                  <td><a href={`#/engineering/blueprints?symbol=${encodeURIComponent(step.blueprintSymbol)}`}><strong>{step.blueprintName}</strong></a><small>{step.moduleNames.join(', ')}</small></td>
                  <td>Grade {step.targetGrade}<small>{step.plannedRolls} planned {step.plannedRolls === 1 ? 'roll' : 'rolls'}</small></td>
                  <td className="wrap">{step.requirements.map(requirement => `${requirement.required} ${requirement.materialName}`).join(' · ')}</td>
                  <td><Button size="sm" variant="danger" onClick={() => actions && void actions.deleteStep(project.id, step.id).catch(cause => onError(message(cause)))}>Remove</Button></td>
                </tr>
              ))}</tbody>
            </DataTable>
          )}
    </section>
  )
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Unable to update engineering projects.'
}
