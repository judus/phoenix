import { useEffect, useState, type FormEvent } from 'react'
import type { EngineeringBlueprintDetail, EngineeringProject } from '@phoenix/contracts'
import { Button, Field, Form, FormActions, FormGrid, Select, Status, TextInput } from '@phoenix/ui'
import type { EngineeringControllerActions } from './use-engineering-controller.js'

export function BlueprintProjectForm({ actions, blueprint, projects }: {
  actions?: EngineeringControllerActions
  blueprint: EngineeringBlueprintDetail
  projects: EngineeringProject[]
}) {
  const active = projects.filter(project => project.status === 'active')
  const [projectId, setProjectId] = useState(active[0]?.id ?? '')
  const [grade, setGrade] = useState(blueprint.grades.at(-1)?.grade ?? 1)
  const [rolls, setRolls] = useState(1)
  const [state, setState] = useState<{ busy: boolean, message?: string, tone?: 'danger' | 'positive' }>({ busy: false })
  useEffect(() => {
    if (!active.some(project => project.id === projectId)) setProjectId(active[0]?.id ?? '')
  }, [active, projectId])
  if (active.length === 0) {
    return <Status tone="muted">No active engineering projects. <a href="#/engineering/projects">Create a project</a> to plan this blueprint.</Status>
  }
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (!actions || !projectId) return
    setState({ busy: true })
    void actions.addStep(projectId, { blueprintSymbol: blueprint.symbol, targetGrade: grade, plannedRolls: rolls, note: null })
      .then(() => setState({ busy: false, message: 'Blueprint step added to project.', tone: 'positive' }))
      .catch(cause => setState({ busy: false, message: cause instanceof Error ? cause.message : 'Unable to add blueprint step.', tone: 'danger' }))
  }
  return (
    <Form className="blueprint-project-form" onSubmit={submit}>
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
      <FormActions><Button busy={state.busy} disabled={!actions} variant="primary">Add to project</Button></FormActions>
      {state.message ? <Status tone={state.tone}>{state.message}</Status> : null}
    </Form>
  )
}
