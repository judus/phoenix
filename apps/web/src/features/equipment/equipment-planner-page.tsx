import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  PersonalEquipmentPlannerEquipment,
  PersonalEquipmentPlannerOptionsResponse,
  PersonalEquipmentPlanPreviewResponse,
  PersonalEquipmentPlannerSource
} from '@phoenix/contracts'
import {
  Button,
  DataTable,
  DataTableGroup,
  DescriptionItem,
  DescriptionList,
  Field,
  Form,
  FormActions,
  FormGrid,
  MultiSelect,
  Section,
  Select,
  Stack,
  Status
} from '@phoenix/ui'
import { EquipmentPageLayout } from './equipment-page-layout.js'
import type { PersonalEquipmentPlannerControllerSnapshot } from './use-personal-equipment-planner-controller.js'

export function EquipmentPlannerPage ({ controller }: { controller: PersonalEquipmentPlannerControllerSnapshot }) {
  if (controller.status !== 'ready' || !controller.options) {
    return <EquipmentPageLayout
      busy={controller.status !== 'error'}
      error={controller.error}
      loadingMessage={controller.status === 'error' ? undefined : 'Loading upgrade planner…'}
      title="Upgrade planner"
    />
  }
  return <Planner options={controller.options} controller={controller} />
}

function Planner ({ controller, options }: {
  controller: PersonalEquipmentPlannerControllerSnapshot
  options: PersonalEquipmentPlannerOptionsResponse
}) {
  const sources = useMemo(() => plannerSources(options), [options])
  const [sourceKey, setSourceKey] = useState(sources[0]?.key ?? '')
  const selectedSource = sources.find(source => source.key === sourceKey) ?? sources[0]
  const [currentGrade, setCurrentGrade] = useState(selectedSource?.currentGrade ?? 1)
  const [targetGrade, setTargetGrade] = useState(selectedSource?.currentGrade ?? 1)
  const [modificationIds, setModificationIds] = useState<string[]>([])
  useEffect(() => {
    const grade = selectedSource?.currentGrade ?? 1
    setCurrentGrade(grade)
    setTargetGrade(grade)
    setModificationIds([])
  }, [sourceKey])
  const effectiveCurrentGrade = selectedSource?.source.kind === 'catalogue' ? currentGrade : selectedSource?.currentGrade ?? 1
  const grades = selectedSource?.equipment.grades ?? []
  const targetGrades = grades.filter(grade => grade.grade >= effectiveCurrentGrade)
  useEffect(() => {
    if (!targetGrades.some(grade => grade.grade === targetGrade)) setTargetGrade(targetGrades[0]?.grade ?? effectiveCurrentGrade)
  }, [effectiveCurrentGrade, targetGrade, targetGrades])
  const installedIds = new Set(selectedSource?.installedModificationIds ?? [])
  const modifications = selectedSource?.equipment.modifications.filter(modification => !installedIds.has(modification.id)) ?? []
  const submit = (event: FormEvent): void => {
    event.preventDefault()
    if (!selectedSource) return
    const source: PersonalEquipmentPlannerSource = selectedSource.source.kind === 'observed'
      ? selectedSource.source
      : { ...selectedSource.source, currentGrade: effectiveCurrentGrade }
    void controller.createPreview({ source, targetGrade, plannedModificationIds: modificationIds })
  }
  return (
    <EquipmentPageLayout title="Upgrade planner" updatedAt={options.generatedAt}>
      <Stack className="record-page-content" gap="lg" tabIndex={0}>
        <Section title="Plan equipment upgrade" description="Preview the materials and specialists required. This does not save a project.">
          {sources.length === 0
            ? <Status tone="muted">No supported personal equipment is available.</Status>
            : <Form onSubmit={submit}>
                <FormGrid>
                  <Field htmlFor="equipment-planner-source" label="Equipment">
                    <Select id="equipment-planner-source" value={sourceKey} onChange={event => setSourceKey(event.target.value)}>
                      {sources.map(source => <option key={source.key} value={source.key}>{source.label}</option>)}
                    </Select>
                  </Field>
                  {selectedSource?.source.kind === 'catalogue' && <Field htmlFor="equipment-planner-current-grade" label="Current grade">
                    <Select id="equipment-planner-current-grade" value={currentGrade} onChange={event => setCurrentGrade(Number(event.target.value))}>
                      {grades.map(grade => <option key={grade.grade} value={grade.grade}>Grade {grade.grade}</option>)}
                    </Select>
                  </Field>}
                  <Field htmlFor="equipment-planner-target-grade" label="Target grade">
                    <Select id="equipment-planner-target-grade" value={targetGrade} onChange={event => setTargetGrade(Number(event.target.value))}>
                      {targetGrades.map(grade => <option key={grade.grade} value={grade.grade}>Grade {grade.grade} — {grade.modificationSlots} slots</option>)}
                    </Select>
                  </Field>
                  <Field htmlFor="equipment-planner-modifications" label="Planned modifications">
                    <MultiSelect
                      id="equipment-planner-modifications"
                      options={modifications.map(modification => ({ label: modification.name, value: modification.id }))}
                      placeholder="No modifications"
                      value={modificationIds}
                      onChange={setModificationIds}
                    />
                  </Field>
                </FormGrid>
                <FormActions message={controller.error ? <Status tone="danger" wrap>{controller.error}</Status> : undefined}>
                  <Button busy={controller.previewing} variant="primary">Preview plan</Button>
                </FormActions>
              </Form>}
        </Section>
        {controller.preview && <PlanPreview preview={controller.preview} />}
      </Stack>
    </EquipmentPageLayout>
  )
}

function PlanPreview ({ preview }: { preview: PersonalEquipmentPlanPreviewResponse }) {
  return <Stack gap="lg">
    <Section title="Plan summary">
      <DescriptionList columns="two" density="compact">
        <DescriptionItem label="Equipment" value={preview.equipment.name} />
        <DescriptionItem label="Grade" value={`${preview.currentGrade} → ${preview.targetGrade}`} />
        <DescriptionItem label="Modification slots" value={`${preview.slots.installed + preview.slots.planned}/${preview.slots.target}`} />
        <DescriptionItem label="Credits" value={preview.credits.complete ? `${preview.credits.total ?? 0} CR` : 'Not published'} />
        <DescriptionItem label="Specialists" value={preview.specialists.map(specialist => specialist.name).join(', ') || 'None'} />
        <DescriptionItem label="Steps" value={String(preview.steps.length)} />
      </DescriptionList>
      {preview.unresolvedInstalledModifications.length > 0 && <Status tone="warning" wrap>
        {preview.unresolvedInstalledModifications.length} installed modification(s) could not be identified; their slots are still reserved.
      </Status>}
    </Section>
    <DataTableGroup title="Material plan" meta={`${preview.materials.filter(material => material.missing > 0).length} missing`}>
      <DataTable label="Material plan" density="compact" narrow="priority">
        <thead><tr><th>Material</th><th>Owned</th><th>Required</th><th>Missing</th></tr></thead>
        <tbody>{preview.materials.length > 0
          ? preview.materials.map(material => <tr key={material.materialId}>
              <th scope="row">{material.materialName}<small>{material.group}</small></th>
              <td>{material.owned}</td><td>{material.required}</td><td>{material.missing}</td>
            </tr>)
          : <tr><td colSpan={4}>No materials required.</td></tr>}
        </tbody>
      </DataTable>
    </DataTableGroup>
    <DataTableGroup title="Work sequence" meta={`${preview.steps.length} steps`}>
      <DataTable label="Work sequence" density="compact" narrow="priority">
        <thead><tr><th>Step</th><th>Materials</th></tr></thead>
        <tbody>{preview.steps.length > 0
          ? preview.steps.map(step => <tr key={step.id}>
              <th scope="row">{step.name}</th>
              <td>{step.ingredients.map(ingredient => `${ingredient.count} ${ingredient.materialName}`).join('; ')}</td>
            </tr>)
          : <tr><td colSpan={2}>No work required.</td></tr>}
        </tbody>
      </DataTable>
    </DataTableGroup>
  </Stack>
}

interface PlannerSourceOption {
  key: string
  label: string
  source: PersonalEquipmentPlannerSource
  equipment: PersonalEquipmentPlannerEquipment
  currentGrade: number
  installedModificationIds: string[]
}

function plannerSources (options: PersonalEquipmentPlannerOptionsResponse): PlannerSourceOption[] {
  return options.equipment.flatMap(equipment => [
    ...equipment.observedInstances.map(instance => ({
      key: `observed:${equipment.kind}:${instance.instanceId}`,
      label: `Owned — ${equipment.name} — G${instance.grade} — #${instance.instanceId}`,
      source: { kind: 'observed' as const, equipmentKind: equipment.kind, instanceId: instance.instanceId },
      equipment,
      currentGrade: instance.grade,
      installedModificationIds: instance.installedModifications.flatMap(modification => modification.id ? [modification.id] : [])
    })),
    {
      key: `catalogue:${equipment.id}`,
      label: `Template — ${equipment.name}`,
      source: { kind: 'catalogue' as const, equipmentId: equipment.id, currentGrade: equipment.grades[0]?.grade ?? 1 },
      equipment,
      currentGrade: equipment.grades[0]?.grade ?? 1,
      installedModificationIds: []
    }
  ])
}
