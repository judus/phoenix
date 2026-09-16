import type { PersonalMaterialInventoryGroup } from '@phoenix/contracts'
import { DataTable, DataTableGroup, Stack } from '@phoenix/ui'
import { EquipmentPageLayout } from './equipment-page-layout.js'
import type { PersonalMaterialsControllerSnapshot } from './use-personal-materials-controller.js'

export function EquipmentMaterialsPage({ controller }: { controller: PersonalMaterialsControllerSnapshot }) {
  if (controller.status !== 'ready' || !controller.inventory) {
    return (
      <EquipmentPageLayout
        busy={controller.status !== 'error'}
        error={controller.status === 'error' ? controller.error : undefined}
        loadingMessage={controller.status === 'error' ? undefined : 'Reading personal material stores…'}
        title="Materials"
      />
    )
  }

  const inventory = controller.inventory
  return (
    <EquipmentPageLayout title="Materials" updatedAt={inventory.updatedAt}>
      <Stack className="record-page-content" gap="xl" tabIndex={0}>
        {inventory.groups.map(group => <MaterialGroup group={group} key={group.id} />)}
      </Stack>
    </EquipmentPageLayout>
  )
}

function MaterialGroup({ group }: { group: PersonalMaterialInventoryGroup }) {
  const units = group.items.reduce((total, item) => total + item.observedTotal, 0)
  return (
    <DataTableGroup meta={`${units} observed`} title={group.label}>
      <DataTable density="compact" label={`${group.label} in observed personal stores`} narrow="priority" scheme="surface">
        <thead><tr><th>Material</th><th className="numeric">Ship locker</th><th className="numeric">Backpack</th><th className="numeric priority-secondary">Mission-tagged</th><th className="numeric">Observed total</th></tr></thead>
        <tbody>
          {group.items.length === 0
            ? <tr><td className="text-muted" colSpan={5}>None observed.</td></tr>
            : group.items.map(item => (
                <tr key={item.id}>
                  <th scope="row"><strong>{item.name}</strong><small>{item.id}</small></th>
                  <td className="numeric">{count(item.shipLocker)}</td>
                  <td className="numeric">{count(item.backpack)}</td>
                  <td className="numeric priority-secondary">{item.missionTagged}</td>
                  <td className="numeric">{item.observedTotal}</td>
                </tr>
              ))}
        </tbody>
      </DataTable>
    </DataTableGroup>
  )
}

function count(value: number | null): number | string {
  return value ?? '—'
}
