import { DataTable, DataTableGroup } from '../components/data-table'
import { Breadcrumbs, PageFrame, PageHeader } from '../components/page'
import './stored-modules-page.css'

type StoredModule = [string, string, string, string, string, string]

const atata: StoredModule[] = [
  ['Frag Cannon', '$hpt_slugshot_gimbal_small_name;', 'Weapon Efficient G1', '58', '41m · 808 CR', '54,720 CR'],
  ['Frag Cannon', '$hpt_slugshot_gimbal_small_name;', 'Weapon Efficient G1', '59', '41m · 808 CR', '54,720 CR'],
  ['Beam Laser', '$hpt_beamlaser_gimbal_small_name;', '—', '67', '41m · 970 CR', '67,185 CR'],
  ['Beam Laser', '$hpt_beamlaser_gimbal_small_name;', '—', '68', '41m · 970 CR', '67,185 CR'],
  ['Multi-Cannon', '$hpt_multicannon_gimbal_medium_name;', '—', '70', '41m · 764 CR', '51,300 CR'],
  ['Plasma Accelerator', '$hpt_plasmaaccelerator_fixed_large_name;', '—', '72', '41m · 39,616 CR', '3,051,200 CR']
]

const localModules: StoredModule[] = [
  ['Shield Generator', '$int_shieldgenerator_size5_class1_name;', '—', '564', '0s · 0 CR', '0 CR'],
  ['Sensors', '$int_sensors_size3_class1_name;', '—', '565', '0s · 0 CR', '0 CR'],
  ['Thrusters', '$int_engine_size5_class1_name;', '—', '566', '0s · 0 CR', '0 CR'],
  ['FSD (SCO)', '$int_hyperdrive_overcharge_size5_class1_name;', '—', '567', '0s · 0 CR', '0 CR'],
  ['Life Support', '$int_lifesupport_size3_class1_name;', '—', '568', '0s · 0 CR', '0 CR'],
  ['Power Distributor', '$int_powerdistributor_size7_class1_name;', '—', '569', '0s · 0 CR', '0 CR'],
  ['Power Plant', '$int_powerplant_size6_class1_name;', '—', '570', '0s · 0 CR', '0 CR']
]

const capricorni: StoredModule[] = [
  ['FSD', '$int_hyperdrive_size5_class1_name;', '—', '576', '43m · 100 CR', '0 CR'],
  ['Thrusters', '$int_engine_size6_class1_name;', '—', '577', '43m · 100 CR', '0 CR'],
  ['Power Plant', '$int_powerplant_size7_class1_name;', '—', '578', '43m · 100 CR', '0 CR']
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
          title="Stored modules"
        />

        <div className="module-groups" tabIndex={0}>
          {storageGroups.map((group) => <StorageTable {...group} key={group.location} />)}
          <footer>
            <strong>Complete snapshot</strong>
            <small>Snapshot 9 Aug · 14:46 · Latest storage change 5 Aug · 01:12</small>
          </footer>
        </div>
      </div>
    </PageFrame>
  )
}
