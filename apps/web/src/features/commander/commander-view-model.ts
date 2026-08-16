import type { MicroResourceInventory, RuntimeState } from '@phoenix/contracts'

const ranks = [
  ['combat', 'Combat'],
  ['trade', 'Trade'],
  ['exploration', 'Exploration'],
  ['federation', 'Federation'],
  ['empire', 'Empire'],
  ['cqc', 'CQC'],
  ['mercenary', 'Mercenary'],
  ['exobiologist', 'Exobiologist']
] as const

export interface CommanderRankModel {
  id: typeof ranks[number][0]
  label: string
  level: string
  progress: number | null
  progressLabel: string
}

export interface CommanderStoreCategoryModel {
  title: string
  count: number
  items: Array<{
    key: string
    identifier: string
    name: string
    quantity: number
    provenance: string
  }>
}

export interface CommanderStoreModel {
  title: string
  meta: string
  categories: CommanderStoreCategoryModel[]
}

export interface CommanderViewModel {
  name: string
  situation: {
    system: string
    place: string
    locationState: string
    ship: string
  }
  ranks: CommanderRankModel[]
  stores: CommanderStoreModel[]
}

export function createCommanderViewModel(
  state: RuntimeState,
  locale = 'en-CH'
): CommanderViewModel {
  return {
    name: state.commander.name ?? 'Unknown commander',
    situation: {
      system: state.system.name ?? 'Unknown',
      place: state.location.place?.name ?? 'Unknown',
      locationState: state.location.state.replaceAll('_', ' '),
      ship: state.ship.name ?? state.ship.definition?.displayName ?? state.ship.typeId ?? 'Unknown'
    },
    ranks: ranks.map(([id, label]) => {
      const level = state.commander.ranks[id]
      const progress = state.commander.rankProgress[id]
      return {
        id,
        label,
        level: level === null ? '—' : `Level ${level}`,
        progress,
        progressLabel: progress === null ? 'Not reported' : `${progress}%`
      }
    }),
    stores: [
      createStore('Ship locker', state.inventory.shipLocker, locale),
      createStore('Backpack', state.inventory.backpack, locale)
    ]
  }
}

function createStore(title: string, inventory: MicroResourceInventory | null, locale: string): CommanderStoreModel {
  const groups = inventory
    ? [
        ['Items', inventory.items],
        ['Components', inventory.components],
        ['Consumables', inventory.consumables],
        ['Data', inventory.data]
      ] as const
    : [
        ['Items', []],
        ['Components', []],
        ['Consumables', []],
        ['Data', []]
      ] as const

  const categories = groups.map(([title, items]) => ({
    title,
    count: items.reduce((total, item) => total + item.count, 0),
    items: items.map(item => ({
      key: `${item.id}:${item.ownerId ?? 'none'}:${item.missionId ?? 'none'}`,
      identifier: item.id,
      name: item.label ?? item.id,
      quantity: item.count,
      provenance: item.missionId !== null
        ? `Mission ${item.missionId}`
        : item.ownerId !== null
          ? `Owner ${item.ownerId}`
          : 'Stored'
    }))
  }))
  const total = categories.reduce((sum, category) => sum + category.count, 0)
  const timestamp = inventory
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(inventory.updatedAt))
    : 'No snapshot'

  return { title, categories, meta: `${total} units · ${timestamp}` }
}
