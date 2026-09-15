import { useState, type FormEvent } from 'react'
import type { EngineeringProjectCreateRequest } from '@phoenix/contracts'
import { Button, Field, Form, FormActions, FormGrid, PageFrame, Section, Select, Stack, Status, Textarea, TextInput } from '@phoenix/ui'
import type { PhoenixRoute } from '../../application/navigation/phoenix-route.js'
import { EngineeringHeader } from './engineering-header.js'
import { engineeringProjectRoutes } from './engineering-navigation.js'
import type { EngineeringControllerActions } from './use-engineering-controller.js'

export function EngineeringProjectNewPage ({ actions, onNavigate, selectedBlueprintSymbol }: {
  actions?: EngineeringControllerActions
  onNavigate(route: PhoenixRoute): void
  selectedBlueprintSymbol?: string
}) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [priority, setPriority] = useState<EngineeringProjectCreateRequest['priority']>('normal')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (!actions || !name.trim()) return
    setSaving(true)
    setError(undefined)
    void actions.createProject({ name, note: note.trim() || null, priority })
      .then(project => onNavigate(selectedBlueprintSymbol
        ? engineeringProjectRoutes.addBlueprint(selectedBlueprintSymbol, project.id)
        : engineeringProjectRoutes.detail(project.id)))
      .catch(cause => {
        setError(cause instanceof Error ? cause.message : 'Project could not be created.')
        setSaving(false)
      })
  }
  return (
    <PageFrame>
      <Stack gap="sm">
        <EngineeringHeader title="New project" trail={[{ label: 'Projects', href: '#/engineering/projects' }, { label: 'New project' }]} />
        <Section title="Project details">
          <Form className="engineering-project-form" onSubmit={submit}>
            <FormGrid>
              <Field htmlFor="engineering-project-name" label="Project name" required>
                <TextInput autoFocus id="engineering-project-name" maxLength={120} required value={name} onChange={event => setName(event.target.value)} />
              </Field>
              <Field htmlFor="engineering-project-priority" label="Priority">
                <Select id="engineering-project-priority" value={priority} onChange={event => setPriority(event.target.value as EngineeringProjectCreateRequest['priority'])}>
                  <option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option>
                </Select>
              </Field>
            </FormGrid>
            <Field htmlFor="engineering-project-note" label="Note">
              <Textarea id="engineering-project-note" maxLength={1000} rows={4} value={note} onChange={event => setNote(event.target.value)} />
            </Field>
            <FormActions
              message={error ? <Status tone="danger" wrap>{error}</Status> : undefined}
              navigation={<Button type="button" variant="outline" onClick={() => onNavigate(engineeringProjectRoutes.index)}>Cancel</Button>}
            >
              <Button busy={saving} disabled={!actions || !name.trim()} variant="primary">Create project</Button>
            </FormActions>
          </Form>
        </Section>
      </Stack>
    </PageFrame>
  )
}
