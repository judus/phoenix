import type {
  PersonalEquipmentGradeUpgradePath,
  PersonalEquipmentModificationView,
  PersonalEquipmentRecipeIngredient,
  PersonalEquipmentUpgradesResponse
} from '@phoenix/contracts'
import { DataTable, DataTableGroup, DescriptionItem, DescriptionList, Stack, Status } from '@phoenix/ui'
import { formatPhoenixCredits } from '../../components/phoenix-credits.js'
import { EquipmentPageLayout } from './equipment-page-layout.js'
import type { PersonalEquipmentUpgradesControllerSnapshot } from './use-personal-equipment-upgrades-controller.js'

export function EquipmentUpgradesPage({ controller, selectedUpgradeId }: {
  controller: PersonalEquipmentUpgradesControllerSnapshot
  selectedUpgradeId?: string
}) {
  if (controller.status !== 'ready' || !controller.upgrades) {
    return (
      <EquipmentPageLayout
        busy={controller.status !== 'error'}
        error={controller.status === 'error' ? controller.error : undefined}
        loadingMessage={controller.status === 'error' ? undefined : 'Loading personal equipment recipes…'}
        title="Upgrades"
      />
    )
  }

  const selectedPath = controller.upgrades.gradeUpgradePaths.find(path => path.id === selectedUpgradeId)
  const selectedModification = controller.upgrades.modifications.find(modification => modification.id === selectedUpgradeId)
  if (selectedUpgradeId && !selectedPath && !selectedModification) {
    return (
      <EquipmentPageLayout title="Upgrade not found" trail={[{ label: 'Upgrades', href: '#/equipment/upgrades' }, { label: 'Not found' }]}>
        <Status tone="danger">The selected personal-equipment upgrade does not exist in this catalogue.</Status>
      </EquipmentPageLayout>
    )
  }
  if (selectedPath) return <GradeUpgradeDetail catalogue={controller.upgrades} path={selectedPath} />
  if (selectedModification) return <ModificationDetail catalogue={controller.upgrades} modification={selectedModification} />
  return <UpgradeIndex catalogue={controller.upgrades} />
}

function UpgradeIndex({ catalogue }: { catalogue: PersonalEquipmentUpgradesResponse }) {
  return (
    <EquipmentPageLayout title="Upgrades" updatedAt={catalogue.generatedAt}>
      <Stack className="record-page-content" gap="xl" tabIndex={0}>
        <CatalogueNotice catalogue={catalogue} />
        <DataTableGroup meta={`${catalogue.gradeUpgradePaths.length} paths`} title="Grade upgrades">
          <DataTable density="compact" label="Personal equipment grade upgrades" narrow="priority" scheme="surface">
            <thead><tr><th>Equipment</th><th>Path</th><th className="priority-secondary">Modification slots</th><th className="priority-secondary">Steps</th></tr></thead>
            <tbody>{catalogue.gradeUpgradePaths.map(path => (
              <tr key={path.id}>
                <th scope="row"><a href={upgradeHref(path.id)}><strong>{path.name}</strong></a><small>{path.equipmentNames.join(', ')}</small></th>
                <td>G{path.fromGrade} → G{path.toGrade}</td>
                <td className="priority-secondary">{path.resultingModificationSlots} at G{path.toGrade}</td>
                <td className="priority-secondary">{path.steps.length}</td>
              </tr>
            ))}</tbody>
          </DataTable>
        </DataTableGroup>
        <DataTableGroup meta={`${catalogue.modifications.length} recipes`} title="Permanent modifications">
          <DataTable density="compact" label="Personal equipment permanent modifications" narrow="priority" scheme="surface">
            <thead><tr><th>Modification</th><th>Target</th><th className="priority-secondary">Engineers</th><th className="priority-tertiary">Materials</th></tr></thead>
            <tbody>{catalogue.modifications.map(modification => (
              <tr key={modification.id}>
                <th scope="row"><a href={upgradeHref(modification.id)}><strong>{modification.name}</strong></a></th>
                <td>{targetLabel(modification)}</td>
                <td className="priority-secondary wrap">{modification.engineers.join(', ')}</td>
                <td className="priority-tertiary">{modification.ingredients.length}</td>
              </tr>
            ))}</tbody>
          </DataTable>
        </DataTableGroup>
      </Stack>
    </EquipmentPageLayout>
  )
}

function GradeUpgradeDetail({ catalogue, path }: {
  catalogue: PersonalEquipmentUpgradesResponse
  path: PersonalEquipmentGradeUpgradePath
}) {
  return (
    <EquipmentPageLayout title={path.name} trail={[{ label: 'Upgrades', href: '#/equipment/upgrades' }, { label: path.name }]} updatedAt={catalogue.generatedAt}>
      <Stack className="record-page-content" gap="xl" tabIndex={0}>
        <CatalogueNotice catalogue={catalogue} />
        <DataTableGroup title="Upgrade path">
          <DescriptionList columns="two" density="compact">
            <DescriptionItem label="Equipment" value={path.equipmentNames.join(', ')} />
            <DescriptionItem label="Path" value={`Grade ${path.fromGrade} to grade ${path.toGrade}`} />
            <DescriptionItem label="Steps" value={path.steps.length} />
            <DescriptionItem label="Final modification slots" value={path.resultingModificationSlots} />
          </DescriptionList>
        </DataTableGroup>
        <DataTableGroup meta={`${path.steps.length} steps`} title="Requirements">
          <DataTable density="compact" label={`${path.name} grade requirements`} narrow="priority" scheme="surface">
            <thead><tr><th>Upgrade</th><th>Materials</th><th className="numeric priority-secondary">Credits</th><th className="numeric priority-secondary">Slots</th></tr></thead>
            <tbody>{path.steps.map(step => (
              <tr key={step.id}>
                <th scope="row"><strong>Grade {step.fromGrade} → {step.toGrade}</strong></th>
                <td className="wrap">{ingredientsLabel(step.ingredients)}</td>
                <td className="numeric priority-secondary">{credits(step.credits)}</td>
                <td className="numeric priority-secondary">{step.resultingModificationSlots}</td>
              </tr>
            ))}</tbody>
          </DataTable>
        </DataTableGroup>
      </Stack>
    </EquipmentPageLayout>
  )
}

function ModificationDetail({ catalogue, modification }: {
  catalogue: PersonalEquipmentUpgradesResponse
  modification: PersonalEquipmentModificationView
}) {
  return (
    <EquipmentPageLayout title={modification.name} trail={[{ label: 'Upgrades', href: '#/equipment/upgrades' }, { label: modification.name }]} updatedAt={catalogue.generatedAt}>
      <Stack className="record-page-content" gap="xl" tabIndex={0}>
        <CatalogueNotice catalogue={catalogue} />
        <DataTableGroup title="Modification">
          <DescriptionList columns="two" density="compact">
            <DescriptionItem label="Target" value={targetLabel(modification)} />
            <DescriptionItem label="Permanent" value="Yes" />
            <DescriptionItem label="Engineers" value={modification.engineers.join(', ')} />
            <DescriptionItem label="Credit cost" value={credits(modification.credits)} />
          </DescriptionList>
        </DataTableGroup>
        <DataTableGroup meta={`${modification.ingredients.length} materials`} title="Requirements">
          <IngredientsTable ingredients={modification.ingredients} label={`${modification.name} requirements`} />
        </DataTableGroup>
      </Stack>
    </EquipmentPageLayout>
  )
}

function IngredientsTable({ ingredients, label }: { ingredients: PersonalEquipmentRecipeIngredient[], label: string }) {
  return (
    <DataTable density="compact" label={label} narrow="priority" scheme="surface">
      <thead><tr><th>Material</th><th>Group</th><th className="numeric">Quantity</th></tr></thead>
      <tbody>{ingredients.map(ingredient => (
        <tr key={ingredient.materialId}>
          <th scope="row"><strong>{ingredient.materialName}</strong></th>
          <td>{titleCase(ingredient.group)}</td>
          <td className="numeric">{ingredient.count}</td>
        </tr>
      ))}</tbody>
    </DataTable>
  )
}

function CatalogueNotice({ catalogue }: { catalogue: PersonalEquipmentUpgradesResponse }) {
  const source = catalogue.sources[0]
  return (
    <Status tone="muted">
      {source ? `${source.name} catalogue ${source.revision.slice(0, 8)}. ` : ''}
      Material requirements are externally reported. Credit costs remain unknown where the catalogue does not provide them.
    </Status>
  )
}

function upgradeHref(id: string): string {
  return `#/equipment/upgrades?id=${encodeURIComponent(id)}`
}

function targetLabel(modification: PersonalEquipmentModificationView): string {
  if (modification.targetKind === 'suit') return 'Suit'
  return modification.engineeringTechnology ? `${titleCase(modification.engineeringTechnology)} weapon` : 'Weapon'
}

function ingredientsLabel(ingredients: PersonalEquipmentRecipeIngredient[]): string {
  return ingredients.map(ingredient => `${ingredient.count} ${ingredient.materialName}`).join(', ')
}

function credits(value: number | null): string {
  return value === null ? '—' : formatPhoenixCredits(value)
}

function titleCase(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1)
}
