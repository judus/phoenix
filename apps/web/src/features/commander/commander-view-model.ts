import { COMMANDER_RANK_NAMES, type MicroResourceInventory, type RuntimeState } from '@phoenix/contracts'

const ranks = [
  ['combat', 'Combat', 'pilot'],
  ['trade', 'Trade', 'pilot'],
  ['exploration', 'Exploration', 'pilot'],
  ['cqc', 'CQC', 'pilot'],
  ['mercenary', 'Mercenary', 'pilot'],
  ['exobiologist', 'Exobiologist', 'pilot'],
  ['federation', 'Federation', 'superpower'],
  ['empire', 'Empire', 'superpower']
] as const

const reputations = [
  ['federation', 'Federation'],
  ['empire', 'Empire'],
  ['alliance', 'Alliance'],
  ['independent', 'Independent']
] as const

const statisticGroupOrder = [
  'Bank_Account',
  'Combat',
  'Trading',
  'Exploration',
  'Mining',
  'Exobiology',
  'Passengers',
  'Search_And_Rescue',
  'Material_Trader_Stats',
  'Smuggling',
  'Crime',
  'Multicrew'
]

export interface CommanderRankModel {
  id: typeof ranks[number][0]
  label: string
  group: typeof ranks[number][2]
  level: string
  progress: number | null
  progressLabel: string
}

export interface CommanderReputationModel {
  id: typeof reputations[number][0]
  label: string
  status: string
  value: number | null
  valueLabel: string
}

export interface CommanderStatisticGroupModel {
  id: string
  label: string
  metrics: Array<{
    id: string
    label: string
    rawValue: number
    value: string
  }>
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
  ranks: CommanderRankModel[]
  reputation: CommanderReputationModel[]
  statistics: {
    groups: CommanderStatisticGroupModel[]
    updatedAt: string
  } | null
  stores: CommanderStoreModel[]
}

export function createCommanderViewModel(
  state: RuntimeState,
  locale = 'en-CH'
): CommanderViewModel {
  return {
    name: state.commander.name ?? 'Unknown commander',
    ranks: ranks.map(([id, label, group]) => {
      const level = state.commander.ranks[id]
      const progress = state.commander.rankProgress[id]
      return {
        id,
        label,
        group,
        level: level === null ? '—' : COMMANDER_RANK_NAMES[id][level] ?? `Rank ${level}`,
        progress,
        progressLabel: progress === null ? 'Not reported' : `${progress}%`
      }
    }),
    reputation: reputations.map(([id, label]) => {
      const value = state.commander.reputation[id]
      const status = reputationStatus(value)
      return {
        id,
        label,
        status,
        value,
        valueLabel: value === null ? 'Not reported' : `${value > 0 ? '+' : ''}${value}%`
      }
    }),
    statistics: state.commander.statistics
      ? {
          groups: createStatisticGroups(state.commander.statistics.groups, locale),
          updatedAt: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
            .format(new Date(state.commander.statistics.updatedAt))
        }
      : null,
    stores: [
      createStore('Ship locker', state.inventory.shipLocker, locale),
      createStore('Backpack', state.inventory.backpack, locale)
    ]
  }
}

function createStatisticGroups(
  groups: Record<string, Record<string, number>>,
  locale: string
): CommanderStatisticGroupModel[] {
  return Object.entries(groups)
    .sort(([left], [right]) => statisticGroupRank(left) - statisticGroupRank(right) || left.localeCompare(right))
    .map(([id, metrics]) => ({
      id,
      label: humanize(id),
      metrics: Object.entries(metrics)
        .sort(([leftId, left], [rightId, right]) => Number(right !== 0) - Number(left !== 0) || leftId.localeCompare(rightId))
        .map(([metricId, rawValue]) => ({
          id: metricId,
          label: humanize(metricId),
          rawValue,
          value: formatStatistic(metricId, rawValue, locale)
        }))
    }))
}

function statisticGroupRank(id: string): number {
  const rank = statisticGroupOrder.indexOf(id)
  return rank === -1 ? statisticGroupOrder.length : rank
}

function formatStatistic(id: string, value: number, locale: string): string {
  if (id === 'Time_Played') return formatDuration(value, locale)
  if (id === 'Total_Hyperspace_Distance' || id === 'Greatest_Distance_From_Start') {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ly`
  }
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
}

function formatDuration(seconds: number, locale: string): string {
  const totalMinutes = Math.floor(seconds / 60)
  const days = Math.floor(totalMinutes / 1_440)
  const hours = Math.floor(totalMinutes % 1_440 / 60)
  const minutes = totalMinutes % 60
  const number = new Intl.NumberFormat(locale)
  return [
    days > 0 ? `${number.format(days)}d` : null,
    hours > 0 ? `${number.format(hours)}h` : null,
    minutes > 0 || totalMinutes === 0 ? `${number.format(minutes)}m` : null
  ].filter(Boolean).join(' ')
}

function reputationStatus(value: number | null): string {
  if (value === null) return 'Unknown'
  if (value < -90) return 'Hostile'
  if (value < -35) return 'Unfriendly'
  if (value <= 4) return 'Neutral'
  if (value <= 35) return 'Cordial'
  if (value <= 90) return 'Friendly'
  return 'Allied'
}

function humanize(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/gu, letter => letter.toUpperCase())
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
