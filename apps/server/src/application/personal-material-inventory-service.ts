import {
  PersonalMaterialInventoryResponseSchema,
  type MicroResource,
  type MicroResourceInventory,
  type PersonalMaterialGroupId,
  type PersonalMaterialInventoryGroup,
  type PersonalMaterialInventoryItem,
  type PersonalMaterialInventoryResponse
} from '@phoenix/contracts'
import type { PersonalMaterialInventoryReader } from '../domain/personal-materials.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'

const GROUPS = [
  { id: 'goods', label: 'Goods', source: 'items' },
  { id: 'assets', label: 'Assets', source: 'components' },
  { id: 'data', label: 'Data', source: 'data' },
  { id: 'consumables', label: 'Consumables', source: 'consumables' }
] as const satisfies ReadonlyArray<{
  id: PersonalMaterialGroupId
  label: string
  source: keyof Pick<MicroResourceInventory, 'items' | 'components' | 'data' | 'consumables'>
}>

interface AccumulatedResource {
  id: string
  name: string
  shipLocker: number
  backpack: number
  missionTagged: number
}

export class PersonalMaterialInventoryService implements PersonalMaterialInventoryReader {
  public constructor (private readonly runtimeState: RuntimeStateReader) {}

  public getInventory (): PersonalMaterialInventoryResponse {
    const { backpack, shipLocker } = this.runtimeState.getCurrent().inventory
    const timestamps = [shipLocker?.updatedAt, backpack?.updatedAt]
      .filter((timestamp): timestamp is string => timestamp !== undefined)
      .sort()

    return PersonalMaterialInventoryResponseSchema.parse({
      schemaVersion: 1,
      updatedAt: timestamps.at(-1) ?? null,
      stores: {
        shipLockerUpdatedAt: shipLocker?.updatedAt ?? null,
        backpackUpdatedAt: backpack?.updatedAt ?? null
      },
      groups: GROUPS.map(group => this.group(group.id, group.label, group.source, shipLocker, backpack))
    })
  }

  private group (
    id: PersonalMaterialGroupId,
    label: string,
    source: keyof Pick<MicroResourceInventory, 'items' | 'components' | 'data' | 'consumables'>,
    shipLocker: MicroResourceInventory | null,
    backpack: MicroResourceInventory | null
  ): PersonalMaterialInventoryGroup {
    const resources = new Map<string, AccumulatedResource>()
    addResources(resources, shipLocker?.[source] ?? [], 'shipLocker')
    addResources(resources, backpack?.[source] ?? [], 'backpack')

    const items: PersonalMaterialInventoryItem[] = [...resources.values()]
      .map(resource => ({
        id: resource.id,
        name: resource.name,
        group: id,
        shipLocker: shipLocker ? resource.shipLocker : null,
        backpack: backpack ? resource.backpack : null,
        observedTotal: resource.shipLocker + resource.backpack,
        missionTagged: resource.missionTagged
      }))
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))

    return { id, label, items }
  }
}

function addResources (
  result: Map<string, AccumulatedResource>,
  resources: MicroResource[],
  store: 'shipLocker' | 'backpack'
): void {
  for (const resource of resources) {
    const current = result.get(resource.id) ?? {
      id: resource.id,
      name: resource.label ?? humanize(resource.id),
      shipLocker: 0,
      backpack: 0,
      missionTagged: 0
    }
    current[store] += resource.count
    if (resource.missionId !== null) current.missionTagged += resource.count
    if (resource.label) current.name = resource.label
    result.set(resource.id, current)
  }
}

function humanize (value: string): string {
  return value
    .replace(/([a-z])([A-Z])/gu, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/\b\w/gu, letter => letter.toUpperCase())
}
