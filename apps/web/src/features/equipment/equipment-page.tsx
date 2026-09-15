import type { CommanderEquipmentResponse } from '@phoenix/contracts'
import { Breadcrumbs, PageFrame, PageHeader, Stack, Status } from '@phoenix/ui'
import type { ReactNode } from 'react'
import { UpdatedDateTime } from '../../components/phoenix-date-time.js'
import { ObservedEquipmentNotice, SuitsTable, WeaponsTable } from './personal-equipment-tables.js'
import type { PersonalEquipmentControllerSnapshot } from './use-personal-equipment-controller.js'

export function EquipmentPage({ controller }: { controller: PersonalEquipmentControllerSnapshot }) {
  if (controller.status !== 'ready' || !controller.equipment) {
    return <EquipmentFrame controller={controller} />
  }

  const equipment = controller.equipment
  return (
    <EquipmentFrame equipment={equipment}>
      <Stack className="record-page-content" gap="xl" tabIndex={0}>
        <ObservedEquipmentNotice />
        <SuitsTable equipment={equipment} />
        <WeaponsTable equipment={equipment} />
      </Stack>
    </EquipmentFrame>
  )
}

function EquipmentFrame({ children, controller, equipment }: {
  children?: ReactNode
  controller?: PersonalEquipmentControllerSnapshot
  equipment?: CommanderEquipmentResponse
}) {
  return (
    <PageFrame className="record-page" layout="fit" aria-busy={controller ? controller.status !== 'error' : undefined}>
      <div className="record-page-layout">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Equipment', href: '#/equipment/gear' }, { label: 'Gear' }]} />}
          title="Gear"
          status={equipment?.updatedAt ? <UpdatedDateTime value={equipment.updatedAt} /> : undefined}
        />
        {controller
          ? <Status tone={controller.status === 'error' ? 'danger' : 'muted'}>
              {controller.status === 'error' ? controller.error : 'Reconstructing personal equipment…'}
            </Status>
          : children}
      </div>
    </PageFrame>
  )
}
