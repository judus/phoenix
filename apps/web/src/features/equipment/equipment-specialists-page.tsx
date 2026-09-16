import type {
  PersonalEquipmentSpecialist,
  PersonalEquipmentSpecialistModification,
  PersonalEquipmentSpecialistsResponse
} from '@phoenix/contracts'
import { DataTable, DataTableGroup, DescriptionItem, DescriptionList, Stack, Status } from '@phoenix/ui'
import { SystemLocationLink } from '../../components/system-location-link.js'
import { EquipmentPageLayout } from './equipment-page-layout.js'
import type { PersonalEquipmentSpecialistsControllerSnapshot } from './use-personal-equipment-specialists-controller.js'

export function EquipmentSpecialistsPage({ controller, selectedSpecialistId }: {
  controller: PersonalEquipmentSpecialistsControllerSnapshot
  selectedSpecialistId?: string
}) {
  if (controller.status !== 'ready' || !controller.specialists) {
    return (
      <EquipmentPageLayout
        busy={controller.status !== 'error'}
        error={controller.status === 'error' ? controller.error : undefined}
        loadingMessage={controller.status === 'error' ? undefined : 'Loading personal equipment specialists…'}
        title="Specialists"
      />
    )
  }

  const selected = controller.specialists.specialists.find(specialist => specialist.id === selectedSpecialistId)
  if (selectedSpecialistId && !selected) {
    return (
      <EquipmentPageLayout title="Specialist not found" trail={[{ label: 'Specialists', href: '#/equipment/specialists' }, { label: 'Not found' }]}>
        <Status tone="danger">The selected personal-equipment specialist does not exist in this catalogue.</Status>
      </EquipmentPageLayout>
    )
  }
  return selected
    ? <SpecialistDetail catalogue={controller.specialists} specialist={selected} />
    : <SpecialistIndex catalogue={controller.specialists} />
}

function SpecialistIndex({ catalogue }: { catalogue: PersonalEquipmentSpecialistsResponse }) {
  const groups = [
    { title: 'Unlocked specialists', states: ['unlocked'] },
    { title: 'Known / invited specialists', states: ['known', 'invited', 'acquainted'] },
    { title: 'Barred specialists', states: ['barred'] },
    { title: 'Locked specialists', states: ['locked'] },
    { title: 'Access not observed', states: ['unknown'] }
  ] as const
  return (
    <EquipmentPageLayout title="Specialists" updatedAt={catalogue.generatedAt}>
      <Stack className="record-page-content" gap="xl" tabIndex={0}>
        {groups.map(group => {
          const specialists = catalogue.specialists.filter(specialist => group.states.some(state => state === specialist.access.state))
          return specialists.length > 0
            ? <SpecialistGroup key={group.title} specialists={specialists} title={group.title} />
            : null
        })}
      </Stack>
    </EquipmentPageLayout>
  )
}

function SpecialistGroup({ specialists, title }: { specialists: PersonalEquipmentSpecialist[], title: string }) {
  return (
    <DataTableGroup meta={`${specialists.length} specialists`} title={title}>
      <DataTable density="compact" label={title} minimum="wide" narrow="priority" scheme="surface">
        <thead><tr><th>Specialist</th><th>Capabilities</th><th>Access</th><th>Location</th></tr></thead>
        <tbody>{specialists.map(specialist => (
          <tr className={specialist.access.state === 'locked' || specialist.access.state === 'unknown' ? 'disabled' : undefined} key={specialist.id}>
            <th scope="row"><a href={specialistHref(specialist.id)}><strong>{specialist.name}</strong></a></th>
            <td>{capabilitySummary(specialist)}</td>
            <td className={specialist.access.state === 'barred' ? 'text-danger' : undefined}>{accessLabel(specialist)}</td>
            <td><SystemLocationLink systemName={specialist.location.systemName} />{specialist.location.distanceLy !== null ? <small>{formatDistance(specialist.location.distanceLy)}</small> : null}</td>
          </tr>
        ))}</tbody>
      </DataTable>
    </DataTableGroup>
  )
}

function SpecialistDetail({ catalogue, specialist }: {
  catalogue: PersonalEquipmentSpecialistsResponse
  specialist: PersonalEquipmentSpecialist
}) {
  return (
    <EquipmentPageLayout
      title={specialist.name}
      trail={[{ label: 'Specialists', href: '#/equipment/specialists' }, { label: specialist.name }]}
      updatedAt={catalogue.generatedAt}
    >
      <Stack className="record-page-content" gap="xl" tabIndex={0}>
        <DataTableGroup title="Access and location">
          <DescriptionList columns="two" density="compact">
            <DescriptionItem label="Access" value={accessLabel(specialist)} />
            <DescriptionItem label="Location" value={<SystemLocationLink systemName={specialist.location.systemName} />} />
            <DescriptionItem label="Distance" value={specialist.location.distanceLy === null ? '—' : formatDistance(specialist.location.distanceLy)} />
          </DescriptionList>
        </DataTableGroup>
        <DataTableGroup meta={`${specialist.modifications.length} modifications`} title="Capabilities">
          <DataTable density="compact" label={`${specialist.name} personal equipment modifications`} narrow="priority" scheme="surface">
            <thead><tr><th>Modification</th><th>Equipment</th><th className="priority-secondary">Technology</th></tr></thead>
            <tbody>{specialist.modifications.map(modification => (
              <tr key={modification.id}>
                <th scope="row"><a href={upgradeHref(modification.id)}><strong>{modification.name}</strong></a></th>
                <td>{targetLabel(modification)}</td>
                <td className="priority-secondary">{modification.engineeringTechnology ? titleCase(modification.engineeringTechnology) : '—'}</td>
              </tr>
            ))}</tbody>
          </DataTable>
        </DataTableGroup>
      </Stack>
    </EquipmentPageLayout>
  )
}

function countTarget(specialist: PersonalEquipmentSpecialist, targetKind: 'suit' | 'weapon'): number {
  return specialist.modifications.filter(modification => modification.targetKind === targetKind).length
}

function capabilitySummary(specialist: PersonalEquipmentSpecialist): string {
  const suits = countTarget(specialist, 'suit')
  const weapons = countTarget(specialist, 'weapon')
  return `${suits} suit / ${weapons} weapon`
}

function accessLabel(specialist: PersonalEquipmentSpecialist): string {
  if (specialist.access.state === 'unknown') return 'Not observed'
  return titleCase(specialist.access.state)
}

function formatDistance(distanceLy: number): string {
  return `${distanceLy.toLocaleString(undefined, { maximumFractionDigits: 0 })} LY`
}

function targetLabel(modification: PersonalEquipmentSpecialistModification): string {
  return modification.targetKind === 'suit' ? 'Suit' : 'Weapon'
}

function specialistHref(id: string): string {
  return `#/equipment/specialists?id=${encodeURIComponent(id)}`
}

function upgradeHref(id: string): string {
  return `#/equipment/upgrades?id=${encodeURIComponent(id)}`
}

function titleCase(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1)
}
