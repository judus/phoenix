import { DataTable, DataTableGroup } from '@phoenix/ui'
import { Breadcrumbs, PageFrame, PageHeader } from '@phoenix/ui'

type StoredModule = [string, string, string, string, string, string]

const atata: StoredModule[] = [
  ['Frag Cannon', '1E · Gimballed', 'Efficient Weapon G1', '58', '41m · 808 CR', '54,720 CR'],
  ['Frag Cannon', '1E · Gimballed', 'Efficient Weapon G1', '59', '41m · 808 CR', '54,720 CR'],
  ['Beam Laser', '1E · Gimballed', '—', '67', '41m · 970 CR', '67,185 CR'],
  ['Beam Laser', '1E · Gimballed', '—', '68', '41m · 970 CR', '67,185 CR'],
  ['Multi-Cannon', '2F · Gimballed', '—', '70', '41m · 764 CR', '51,300 CR'],
  ['Plasma Accelerator', '3B · Fixed', '—', '72', '41m · 39,616 CR', '3,051,200 CR']
]

const localModules: StoredModule[] = [
  ['Shield Generator', '5E', '—', '564', '0s · 0 CR', '0 CR'],
  ['Sensors', '3E', '—', '565', '0s · 0 CR', '0 CR'],
  ['Thrusters', '5E', '—', '566', '0s · 0 CR', '0 CR'],
  ['FSD (SCO)', '5E', '—', '567', '0s · 0 CR', '0 CR'],
  ['Life Support', '3E', '—', '568', '0s · 0 CR', '0 CR'],
  ['Power Distributor', '7E', '—', '569', '0s · 0 CR', '0 CR'],
  ['Power Plant', '6E', '—', '570', '0s · 0 CR', '0 CR']
]

const capricorni: StoredModule[] = [
  ['FSD', '5E', '—', '576', '43m · 100 CR', '0 CR'],
  ['Thrusters', '6E', '—', '577', '43m · 100 CR', '0 CR'],
  ['Power Plant', '7E', '—', '578', '43m · 100 CR', '0 CR']
]

const storageGroups = [
  { location: 'Atata', count: 61, modules: atata },
  { location: 'Col 285 Sector OK-C B14-5', count: 7, modules: localModules },
  { location: 'Capricorni Sector DG-X B1-1', count: 3, modules: capricorni }
]

function StorageTable({ count, location, modules }: { count: number, location: string, modules: StoredModule[] }) {
  return (
    <DataTableGroup className="module-storage" meta={`${count} modules`} title={location}>
      <DataTable density="compact" label={`Modules stored at ${location}`} narrow="priority" scheme="surface">
        <thead>
          <tr>
            <th scope="col">Module</th>
            <th scope="col">Engineering</th>
            <th className="numeric" scope="col">Storage slot</th>
            <th scope="col">Transfer</th>
            <th className="numeric" scope="col">Purchase value</th>
            <th scope="col">Observed</th>
          </tr>
        </thead>
        <tbody>
          {modules.map(([name, identifier, engineering, slot, transfer, value]) => (
            <tr key={slot}>
              <td>
                <strong>{name}</strong>
                <small>{identifier}</small>
              </td>
              <td className={engineering !== '—' ? 'text-information' : undefined}>{engineering}</td>
              <td className="numeric">{slot}</td>
              <td>{transfer}</td>
              <td className="numeric">{value}</td>
              <td>9 Aug · 14:46</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </DataTableGroup>
  )
}

export function StoredModulesPage() {
  return (
    <PageFrame layout="fit">
      <div className="stored-modules">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Fleet', href: '#fleet' }, { label: 'Stored modules' }]} />}
          status="Complete snapshot · Snapshot 9 Aug · 14:46 · Latest storage change 5 Aug · 01:12"
          title="Stored modules"
        />

        <div className="module-groups" tabIndex={0}>
          {storageGroups.map((group) => <StorageTable {...group} key={group.location} />)}
        </div>
      </div>
    </PageFrame>
  )
}
