import { Stack } from '@phoenix/ui'
import { EquipmentPageLayout } from './equipment-page-layout.js'
import { SuitsTable, WeaponsTable } from './personal-equipment-tables.js'
import type { PersonalEquipmentControllerSnapshot } from './use-personal-equipment-controller.js'

export function EquipmentPage({ controller }: { controller: PersonalEquipmentControllerSnapshot }) {
  if (controller.status !== 'ready' || !controller.equipment) {
    return (
      <EquipmentPageLayout
        busy={controller.status !== 'error'}
        error={controller.status === 'error' ? controller.error : undefined}
        loadingMessage={controller.status === 'error' ? undefined : 'Reconstructing personal equipment…'}
        title="Gear"
      />
    )
  }

  const equipment = controller.equipment
  return (
    <EquipmentPageLayout title="Gear" updatedAt={equipment.updatedAt}>
      <Stack className="record-page-content" gap="xl" tabIndex={0}>
        <SuitsTable equipment={equipment} />
        <WeaponsTable equipment={equipment} />
      </Stack>
    </EquipmentPageLayout>
  )
}
