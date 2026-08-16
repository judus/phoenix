import { DataTable, DataTableGroup } from '@phoenix/ui'
import { AutoGrid, Stack } from '@phoenix/ui'
import { Breadcrumbs, PageFrame, PageHeader } from '@phoenix/ui'
import './personal-stores-page.css'

type StoreItem = {
  identifier: string
  name: string
  quantity: number
}

type StoreCategory = {
  items: StoreItem[]
  title: string
}

const consumables: StoreItem[] = [
  { name: 'Medkit', identifier: 'healthpack', quantity: 7 },
  { name: 'Energy Cell', identifier: 'energycell', quantity: 11 },
  { name: 'Shield Disruptor', identifier: 'amm_grenade_emp', quantity: 7 },
  { name: 'Frag Grenade', identifier: 'amm_grenade_frag', quantity: 5 },
  { name: 'Shield Projector', identifier: 'amm_grenade_shield', quantity: 7 }
]

const emptyCategories: StoreCategory[] = [
  { title: 'Items', items: [] },
  { title: 'Components', items: [] },
  { title: 'Consumables', items: [] },
  { title: 'Data', items: [] }
]

const lockerCategories: StoreCategory[] = [
  { title: 'Items', items: [] },
  { title: 'Components', items: [] },
  { title: 'Consumables', items: consumables },
  { title: 'Data', items: [] }
]

function CategoryTable({ items, title }: StoreCategory) {
  const count = items.reduce((total, item) => total + item.quantity, 0)

  return (
    <DataTableGroup meta={count} title={title} tone="muted">
      <DataTable density="compact" label={`${title} in personal storage`} narrow="priority" scheme="surface">
        <tbody>
          {items.length > 0 ? items.map((item) => (
            <tr key={item.identifier}>
              <td>
                <strong>{item.name}</strong>
                <small>{item.identifier}</small>
              </td>
              <td className="numeric">{item.quantity}</td>
            </tr>
          )) : (
            <tr>
              <td className="text-muted" colSpan={2}>None</td>
            </tr>
          )}
        </tbody>
      </DataTable>
    </DataTableGroup>
  )
}

function StoreGroup({ categories, meta, title }: { categories: StoreCategory[]; meta: string; title: string }) {
  return (
    <DataTableGroup className="store-group" meta={meta} title={title}>
      <AutoGrid gap="md" minimum="xl">
        {categories.map((category) => <CategoryTable {...category} key={category.title} />)}
      </AutoGrid>
    </DataTableGroup>
  )
}

export function PersonalStoresPage() {
  return (
    <PageFrame layout="fit">
      <div className="personal-stores">
        <PageHeader
          variant="cockpit"
          context={<Breadcrumbs items={[{ label: 'Commander', href: '#commander' }, { label: 'Personal stores' }]} />}
          title="Personal stores"
        />

        <Stack className="store-groups" gap="xl" tabIndex={0}>
          <StoreGroup categories={lockerCategories} meta="37 units · 15 Aug, 18:28" title="Ship locker" />
          <StoreGroup categories={emptyCategories} meta="0 units · 7 Aug, 00:14" title="Backpack" />
        </Stack>
      </div>
    </PageFrame>
  )
}
