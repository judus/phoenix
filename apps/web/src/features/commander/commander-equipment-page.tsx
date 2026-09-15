import type {
  CommanderEquipmentResponse,
  CommanderSuit,
  CommanderSuitLoadout,
  CommanderWeapon
} from '@phoenix/contracts'
import { Breadcrumbs, DataTable, DataTableGroup, PageFrame, PageHeader, Stack, Status } from '@phoenix/ui'
import { formatPhoenixCredits } from '../../components/phoenix-credits.js'
import { UpdatedDateTime } from '../../components/phoenix-date-time.js'
import type { CommanderEquipmentControllerSnapshot } from './use-commander-equipment-controller.js'

export function CommanderEquipmentPage({ controller }: { controller: CommanderEquipmentControllerSnapshot }) {
  if (controller.status !== 'ready' || !controller.equipment) {
    return (
      <PageFrame className="commander-page" layout="fit" aria-busy={controller.status !== 'error'}>
        <div className="commander-layout">
          <EquipmentHeader />
          <Status tone={controller.status === 'error' ? 'danger' : 'muted'}>
            {controller.status === 'error' ? controller.error : 'Reconstructing commander equipment…'}
          </Status>
        </div>
      </PageFrame>
    )
  }

  const equipment = controller.equipment
  return (
    <PageFrame className="commander-page" layout="fit">
      <div className="commander-layout">
        <EquipmentHeader equipment={equipment} />
        <Stack className="commander-content" gap="xl" tabIndex={0}>
          <Status tone="muted">
            Equipment ownership is reconstructed from retained Elite journals. Elite does not publish a complete owned-equipment manifest.
          </Status>
          <LoadoutsTable equipment={equipment} />
          <SuitsTable equipment={equipment} />
          <WeaponsTable equipment={equipment} />
        </Stack>
      </div>
    </PageFrame>
  )
}

function EquipmentHeader({ equipment }: { equipment?: CommanderEquipmentResponse }) {
  return (
    <PageHeader
      variant="cockpit"
      context={<Breadcrumbs items={[{ label: 'Commander', href: '#/commander/career' }, { label: 'Equipment' }]} />}
      title="Commander Equipment"
      status={equipment?.updatedAt ? <UpdatedDateTime value={equipment.updatedAt} /> : undefined}
    />
  )
}

function LoadoutsTable({ equipment }: { equipment: CommanderEquipmentResponse }) {
  const suits = new Map(equipment.suits.map(suit => [suit.id, suit]))
  const weapons = new Map(equipment.weapons.map(weapon => [weapon.id, weapon]))
  return (
    <DataTableGroup meta={`${equipment.summary.loadouts} observed`} title="Suit loadouts">
      <DataTable density="compact" label="Observed suit loadouts" narrow="priority" scheme="surface">
        <thead><tr><th>Loadout</th><th>Suit</th><th className="priority-secondary">Weapons</th></tr></thead>
        <tbody>
          {equipment.loadouts.length === 0
            ? <tr><td className="text-muted" colSpan={3}>No suit loadouts observed.</td></tr>
            : equipment.loadouts.map(loadout => (
                <tr key={loadout.id}>
                  <th scope="row">
                    <strong>{loadout.name}</strong>
                    {loadout.id === equipment.currentLoadoutId ? <small>Equipped</small> : null}
                  </th>
                  <td>{equipmentName(suits.get(loadout.suitId))}</td>
                  <td className="priority-secondary">{loadoutWeapons(loadout, weapons)}</td>
                </tr>
              ))}
        </tbody>
      </DataTable>
    </DataTableGroup>
  )
}

function SuitsTable({ equipment }: { equipment: CommanderEquipmentResponse }) {
  const loadouts = new Map(equipment.loadouts.map(loadout => [loadout.id, loadout.name]))
  return (
    <DataTableGroup meta={`${equipment.summary.suits} observed`} title="Suits">
      <DataTable density="compact" label="Observed suits" narrow="priority" scheme="surface">
        <thead><tr><th>Suit</th><th>Grade</th><th className="priority-secondary">Modifications</th><th className="priority-tertiary">Loadouts</th><th className="numeric">Purchase price</th></tr></thead>
        <tbody>
          {equipment.suits.length === 0
            ? <tr><td className="text-muted" colSpan={5}>No suits observed.</td></tr>
            : equipment.suits.map(suit => (
                <tr key={suit.id}>
                  <th scope="row"><strong>{suit.displayName}</strong></th>
                  <td>{gradeDetails(suit)}</td>
                  <td className="priority-secondary">{modificationsLabel(suit)}</td>
                  <td className="priority-tertiary">{loadoutNames(suit.loadoutIds, loadouts)}</td>
                  <td className="numeric">{purchasePrice(suit)}</td>
                </tr>
              ))}
        </tbody>
      </DataTable>
    </DataTableGroup>
  )
}

function WeaponsTable({ equipment }: { equipment: CommanderEquipmentResponse }) {
  const loadouts = new Map(equipment.loadouts.map(loadout => [loadout.id, loadout.name]))
  return (
    <DataTableGroup meta={`${equipment.summary.weapons} observed`} title="Personal weapons">
      <DataTable density="compact" label="Observed personal weapons" narrow="priority" scheme="surface">
        <thead><tr><th>Weapon</th><th>Grade</th><th className="priority-secondary">Type</th><th className="priority-secondary">Modifications</th><th className="priority-tertiary">Loadouts</th><th className="numeric">Purchase price</th></tr></thead>
        <tbody>
          {equipment.weapons.length === 0
            ? <tr><td className="text-muted" colSpan={6}>No personal weapons observed.</td></tr>
            : equipment.weapons.map(weapon => (
                <tr key={weapon.id}>
                  <th scope="row"><strong>{weapon.displayName}</strong><small>{weapon.manufacturer ?? weapon.symbol}</small></th>
                  <td>{gradeDetails(weapon)}</td>
                  <td className="priority-secondary">{[weapon.category, weapon.damageType].filter(Boolean).join(', ') || '—'}</td>
                  <td className="priority-secondary">{modificationsLabel(weapon)}</td>
                  <td className="priority-tertiary">{loadoutNames(weapon.loadoutIds, loadouts)}</td>
                  <td className="numeric">{purchasePrice(weapon)}</td>
                </tr>
              ))}
        </tbody>
      </DataTable>
    </DataTableGroup>
  )
}

function equipmentName(equipment: CommanderSuit | CommanderWeapon | undefined): string {
  return equipment ? `${equipment.displayName}, ${gradeLabel(equipment.grade)}` : 'Unknown equipment'
}

function gradeLabel(grade: number | null): string {
  return grade === null ? '—' : `Grade ${grade}`
}

function gradeDetails(equipment: CommanderSuit | CommanderWeapon) {
  if (!equipment.lastUpgrade) return gradeLabel(equipment.grade)
  const resources = equipment.lastUpgrade.resources
    .map(resource => `${resource.count} ${resource.displayName}`)
    .join(', ')
  return (
    <>
      <strong>{gradeLabel(equipment.grade)}</strong>
      <small>Last upgrade: {[formatPhoenixCredits(equipment.lastUpgrade.credits), resources].filter(Boolean).join('; ')}</small>
    </>
  )
}

function modificationsLabel(equipment: CommanderSuit | CommanderWeapon): string {
  return equipment.modifications.map(modification => modification.displayName).join(', ') || '—'
}

function loadoutNames(ids: number[], loadouts: Map<number, string>): string {
  return ids.map(id => loadouts.get(id)).filter((name): name is string => name !== undefined).join(', ') || '—'
}

function loadoutWeapons(loadout: CommanderSuitLoadout, weapons: Map<number, CommanderWeapon>): string {
  return loadout.slots
    .map(slot => weapons.get(slot.weaponId)?.displayName ?? 'Unknown weapon')
    .join(', ') || '—'
}

function purchasePrice(equipment: CommanderSuit | CommanderWeapon): string {
  return equipment.purchasePrice === null ? '—' : formatPhoenixCredits(equipment.purchasePrice)
}
