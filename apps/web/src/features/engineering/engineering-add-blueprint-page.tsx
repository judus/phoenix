import { useEffect, useState, type FormEvent } from 'react'
import type { EngineeringBlueprintDetail, EngineeringProject } from '@phoenix/contracts'
import { Button, Field, Form, FormActions, FormGrid, PageFrame, Section, Select, Stack, Status, Textarea, TextInput } from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { EngineeringHeader } from './engineering-header.js'
import { engineeringProjectRoutes } from './engineering-navigation.js'
import type { EngineeringControllerActions } from './use-engineering-controller.js'

export function EngineeringAddBlueprintPage ({ actions, blueprint, onNavigate, projects, selectedProjectId }: {
  actions?: EngineeringControllerActions
  blueprint: EngineeringBlueprintDetail
  onNavigate(route: PhoenixRoute): void
  projects: EngineeringProject[]
  selectedProjectId?: string
}) {
  const active = projects.filter(project => project.status === 'active')
  const [projectId, setProjectId] = useState(selectedProjectId && active.some(project => project.id === selectedProjectId) ? selectedProjectId : active[0]?.id ?? '')
  const [grade, setGrade] = useState(blueprint.grades.at(-1)?.grade ?? 1)
  const [rolls, setRolls] = useState(1)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  useEffect(() => {
    if (!active.some(project => project.id === projectId)) setProjectId(active[0]?.id ?? '')
  }, [active, projectId])
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (!actions || !projectId) return
    setSaving(true)
    setError(undefined)
    void actions.addStep(projectId, { blueprintSymbol: blueprint.symbol, targetGrade: grade, plannedRolls: rolls, note: note.trim() || null })
      .then(() => onNavigate(engineeringProjectRoutes.detail(projectId)))
      .catch(cause => {
        setError(cause instanceof Error ? cause.message : 'Blueprint could not be added to the project.')
        setSaving(false)
      })
  }
  const blueprintRoute = { kind: 'information', section: 'engineering', view: 'blueprints', selectedBlueprintSymbol: blueprint.symbol } as const
  return (
    <PageFrame>
      <Stack gap="sm">
        <EngineeringHeader title={`Add ${blueprint.name}`} trail={[{ label: 'Blueprints', href: '#/engineering/blueprints' }, { label: blueprint.name, href: `#/engineering/blueprints?symbol=${encodeURIComponent(blueprint.symbol)}` }, { label: 'Add to project' }]} />
        {active.length > 0
          ? (
              <Section title="Project step">
                <Form className="engineering-project-form" onSubmit={submit}>
                  <FormGrid>
                    <Field htmlFor="blueprint-project" label="Project">
                      <Select id="blueprint-project" value={projectId} onChange={event => setProjectId(event.target.value)}>
                        {active.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
                      </Select>
                    </Field>
                    <Field htmlFor="blueprint-grade" label="Target grade">
                      <Select id="blueprint-grade" value={grade} onChange={event => setGrade(Number(event.target.value))}>
                        {blueprint.grades.map(candidate => <option key={candidate.grade} value={candidate.grade}>Grade {candidate.grade}</option>)}
                      </Select>
                    </Field>
                    <Field htmlFor="blueprint-rolls" label="Planned rolls">
                      <TextInput id="blueprint-rolls" inputMode="numeric" min={1} max={100} type="number" value={rolls} onChange={event => setRolls(Number(event.target.value))} />
                    </Field>
                  </FormGrid>
                  <Field htmlFor="blueprint-project-note" label="Step note">
                    <Textarea id="blueprint-project-note" maxLength={500} rows={3} value={note} onChange={event => setNote(event.target.value)} />
                  </Field>
                  <FormActions
                    message={error ? <Status tone="danger" wrap>{error}</Status> : undefined}
                    navigation={<Button type="button" variant="outline" onClick={() => onNavigate(blueprintRoute)}>Cancel</Button>}
                  >
                    <Button busy={saving} disabled={!actions || !projectId} variant="primary">Add blueprint</Button>
                  </FormActions>
                </Form>
              </Section>
            )
          : (
              <Section title="Project required">
                <Stack gap="sm">
                  <Status tone="muted">Create an active project before adding this blueprint.</Status>
                  <div><Button variant="primary" onClick={() => onNavigate(engineeringProjectRoutes.new(blueprint.symbol))}>New project</Button></div>
                </Stack>
              </Section>
            )}
      </Stack>
    </PageFrame>
  )
}
