import type { CommanderEquipmentResponse } from '@phoenix/contracts'
import { Breadcrumbs, PageFrame, PageHeader, Stack, Status } from '@phoenix/ui'
import type { ReactNode } from 'react'
import { UpdatedDateTime } from '../../components/phoenix-date-time.js'
import { SuitLoadoutsTable } from './personal-equipment-tables.js'
import type { PersonalEquipmentControllerSnapshot } from './use-personal-equipment-controller.js'

export function CommanderLoadoutsPage({ controller }: { controller: PersonalEquipmentControllerSnapshot }) {
  if (controller.status !== 'ready' || !controller.equipment) {
    return <LoadoutsFrame controller={controller} />
  }

  const equipment = controller.equipment
  return (
    <LoadoutsFrame equipment={equipment}>
      <Stack className="record-page-content" gap="xl" tabIndex={0}>
        <SuitLoadoutsTable equipment={equipment} />
      </Stack>
    </LoadoutsFrame>
  )
}

function LoadoutsFrame({ children, controller, equipment }: {
  children?: ReactNode
  controller?: PersonalEquipmentControllerSnapshot
  equipment?: CommanderEquipmentResponse
}) {
  return (
    <PageFrame className="record-page" layout="fit" aria-busy={controller ? controller.status !== 'error' : undefined}>
      <div className="record-page-layout">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Commander', href: '#/commander/career' }, { label: 'Suit Loadouts' }]} />}
          title="Suit Loadouts"
          status={equipment?.updatedAt ? <UpdatedDateTime value={equipment.updatedAt} /> : undefined}
        />
        {controller
          ? <Status tone={controller.status === 'error' ? 'danger' : 'muted'}>
              {controller.status === 'error' ? controller.error : 'Reconstructing commander loadouts…'}
            </Status>
          : children}
      </div>
    </PageFrame>
  )
}
