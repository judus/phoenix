import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { EngineeringMaterialWatchlistResponse, EngineeringProject } from '@phoenix/contracts'
import {
  Button,
  CheckIcon,
  CrossIcon,
  DataTable,
  DataTableGroup,
  DescriptionItem,
  DescriptionList,
  Field,
  Form,
  FormActions,
  FormGrid,
  IconButton,
  PageFrame,
  Section,
  Select,
  Stack,
  Status,
  Textarea,
  TextInput,
  TrashIcon
} from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { phoenixRouteHash } from '../../application/navigation/phoenix-router.js'
import { EngineeringHeader } from './engineering-header.js'
import { engineeringProjectRoutes } from './engineering-navigation.js'
import type { EngineeringControllerActions } from './use-engineering-controller.js'

type EngineeringProjectPriority = EngineeringProject['priority']
type EngineeringProjectStatus = EngineeringProject['status']

export function EngineeringProjectDetailPage ({ actions, onNavigate, project, watchlist }: {
  actions?: EngineeringControllerActions
  onNavigate(route: PhoenixRoute): void
  project: EngineeringProject
  watchlist?: EngineeringMaterialWatchlistResponse
}) {
  const [editing, setEditing] = useState(false)
  useEffect(() => setEditing(false), [project.id])
  return (
    <PageFrame layout="fit">
      <Stack fill gap="sm">
        <EngineeringHeader
          actions={!editing ? <Button disabled={!actions} variant="outline" onClick={() => setEditing(true)}>Edit project</Button> : undefined}
          title={project.name}
          trail={[{ label: 'Projects', href: '#/engineering/projects' }, { label: project.name }]}
        />
        <Stack className="engineering-scroll-content" gap="sm">
          {editing
            ? <ProjectSettings actions={actions} onNavigate={onNavigate} onClose={() => setEditing(false)} project={project} />
            : <Section title="Project details">
                <DescriptionList columns="two" density="compact">
                  <DescriptionItem label="Priority" value={project.priority} />
                  <DescriptionItem label="Status" value={project.status} />
                  <DescriptionItem label="Note" value={project.note ?? '—'} />
                </DescriptionList>
              </Section>}
          <ProjectSteps actions={actions} project={project} />
          <ProjectMaterialPlan project={project} watchlist={watchlist} />
        </Stack>
      </Stack>
    </PageFrame>
  )
}

function ProjectSettings ({ actions, onClose, onNavigate, project }: {
  actions?: EngineeringControllerActions
  onClose(): void
  onNavigate(route: PhoenixRoute): void
  project: EngineeringProject
}) {
  const [name, setName] = useState(project.name)
  const [note, setNote] = useState(project.note ?? '')
  const [priority, setPriority] = useState<EngineeringProjectPriority>(project.priority)
  const [status, setStatus] = useState<EngineeringProjectStatus>(project.status)
  const [working, setWorking] = useState<'save' | 'delete'>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    setName(project.name)
    setNote(project.note ?? '')
    setPriority(project.priority)
    setStatus(project.status)
  }, [project.id, project.name, project.note, project.priority, project.status])
  const save = (event: FormEvent): void => {
    event.preventDefault()
    if (!actions || !name.trim()) return
    setWorking('save')
    setError(undefined)
    void actions.updateProject(project.id, { name, note: note.trim() || null, priority, status })
      .then(onClose)
      .catch(cause => {
        setError(message(cause))
        setWorking(undefined)
      })
  }
  const remove = (): void => {
    if (!actions) return
    setWorking('delete')
    setError(undefined)
    void actions.deleteProject(project.id)
      .then(() => onNavigate(engineeringProjectRoutes.index))
      .catch(cause => {
        setError(message(cause))
        setWorking(undefined)
      })
  }
  return (
    <Section title="Project settings">
      <Form className="engineering-project-form" onSubmit={save}>
        <FormGrid>
          <Field htmlFor="engineering-project-name" label="Project name" required>
            <TextInput id="engineering-project-name" maxLength={120} required value={name} onChange={event => setName(event.target.value)} />
          </Field>
          <Field htmlFor="engineering-project-priority" label="Priority">
            <Select id="engineering-project-priority" value={priority} onChange={event => setPriority(event.target.value as EngineeringProjectPriority)}>
              <option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option>
            </Select>
          </Field>
          <Field htmlFor="engineering-project-status" label="Status">
            <Select id="engineering-project-status" value={status} onChange={event => setStatus(event.target.value as EngineeringProjectStatus)}>
              <option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="archived">Archived</option>
            </Select>
          </Field>
        </FormGrid>
        <Field htmlFor="engineering-project-note" label="Note">
          <Textarea id="engineering-project-note" maxLength={1000} rows={3} value={note} onChange={event => setNote(event.target.value)} />
        </Field>
        <FormActions
          message={error ? <Status tone="danger" wrap>{error}</Status> : undefined}
          navigation={<Button disabled={working !== undefined} type="button" variant="outline" onClick={onClose}>Cancel</Button>}
        >
          <IconButton busy={working === 'delete'} disabled={!actions || working === 'save'} label={`Delete ${project.name}`} type="button" variant="danger" onClick={remove}><TrashIcon /></IconButton>
          <IconButton busy={working === 'save'} disabled={!actions || !name.trim() || working === 'delete'} label="Save project" type="submit" variant="primary"><CheckIcon /></IconButton>
        </FormActions>
      </Form>
    </Section>
  )
}

function ProjectSteps ({ actions, project }: { actions?: EngineeringControllerActions, project: EngineeringProject }) {
  const [removing, setRemoving] = useState<string>()
  const [error, setError] = useState<string>()
  return (
    <DataTableGroup contentGap="sm" meta={`${project.steps.length} ${project.steps.length === 1 ? 'step' : 'steps'}`} title="Planned engineering">
      {error ? <Status tone="danger" wrap>{error}</Status> : null}
      {project.steps.length > 0
        ? (
            <DataTable density="compact" label={`${project.name} planned engineering`} minimum="wide" narrow="priority" scheme="surface">
              <thead><tr><th>Blueprint / effect</th><th>Grade</th><th>Rolls / applications</th><th>Materials</th><th aria-label="Actions" /></tr></thead>
              <tbody>{project.steps.map(step => (
                <tr key={step.id}>
                  <td className="wrap"><a href={step.kind === 'blueprint' ? `#/engineering/blueprints?symbol=${encodeURIComponent(step.blueprintSymbol)}` : `#/engineering/experimental-effects?symbol=${encodeURIComponent(step.effectSymbol)}`}><strong>{step.kind === 'blueprint' ? step.blueprintName : step.effectName}</strong></a><small>{step.moduleNames.join(', ')}</small></td>
                  <td>{step.kind === 'blueprint' ? `Grade ${step.targetGrade}` : 'Experimental'}</td>
                  <td>{step.kind === 'blueprint' ? step.plannedRolls : step.applications}</td>
                  <td>{step.requirements.length} {step.requirements.length === 1 ? 'type' : 'types'}<small>{step.requirements.reduce((total, requirement) => total + requirement.required, 0)} units</small></td>
                  <td className="col-fit"><IconButton busy={removing === step.id} disabled={!actions || removing !== undefined} label={`Remove ${step.kind === 'blueprint' ? step.blueprintName : step.effectName}`} size="sm" variant="danger" onClick={() => {
                    if (!actions) return
                    setRemoving(step.id)
                    setError(undefined)
                    void actions.deleteStep(project.id, step.id)
                      .catch(cause => setError(message(cause)))
                      .finally(() => setRemoving(undefined))
                  }}><CrossIcon /></IconButton></td>
                </tr>
              ))}</tbody>
            </DataTable>
          )
        : <Status tone="muted">No engineering planned. Open a blueprint or experimental effect from the catalogue to add it to this project.</Status>}
    </DataTableGroup>
  )
}

function ProjectMaterialPlan ({ project, watchlist }: { project: EngineeringProject, watchlist?: EngineeringMaterialWatchlistResponse }) {
  const materials = useMemo(() => aggregateRequirements(project, watchlist), [project, watchlist])
  return (
    <DataTableGroup meta={`${materials.length} ${materials.length === 1 ? 'material' : 'materials'}`} title="Project material plan">
      {materials.length > 0
        ? (
            <DataTable density="compact" label={`${project.name} material plan`} narrow="priority" scheme="surface">
              <thead><tr><th>Material</th><th>Required</th><th>Missing</th></tr></thead>
              <tbody>{materials.map(material => (
                <tr key={material.id}>
                  <td><strong>{material.name}</strong><small>{material.category ?? 'Unknown'}{material.grade ? ` · G${material.grade}` : ''}</small></td>
                  <td>{material.required}</td>
                  <td className={material.missing && material.missing > 0 ? 'text-danger' : undefined}>{material.missing ?? '—'}</td>
                </tr>
              ))}</tbody>
            </DataTable>
          )
        : <Status tone="muted">This project has no material requirements yet.</Status>}
    </DataTableGroup>
  )
}

function aggregateRequirements (project: EngineeringProject, watchlist?: EngineeringMaterialWatchlistResponse) {
  const materials = new Map<string, { id: string, name: string, category: string | null, grade: number | null, required: number }>()
  for (const step of project.steps) {
    for (const requirement of step.requirements) {
      const current = materials.get(requirement.materialId)
      materials.set(requirement.materialId, {
        id: requirement.materialId,
        name: requirement.materialName,
        category: requirement.category,
        grade: requirement.grade,
        required: (current?.required ?? 0) + requirement.required
      })
    }
  }
  return [...materials.values()].map(material => {
    if (project.status !== 'active') return { ...material, missing: null }
    const watched = watchlist?.materials.find(candidate => candidate.materialId === material.id && candidate.projects.some(candidate => candidate.id === project.id))
    return { ...material, missing: watched ? Math.max(0, material.required - watched.owned) : 0 }
  }).sort((left, right) => (right.missing ?? -1) - (left.missing ?? -1) || left.name.localeCompare(right.name))
}

function message (cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Project could not be updated.'
}
