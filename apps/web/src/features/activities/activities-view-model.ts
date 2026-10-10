import type { Mission, MissionStatus, MissionsResponse } from '@phoenix/contracts'
import type { StatusTone } from '@phoenix/ui'
import { formatPhoenixCredits } from '../../components/phoenix-credits.js'
import { formatPhoenixDateTime } from '../../components/phoenix-date-time.js'

export interface MissionViewModel {
  accepted: string
  details: Array<{ label: string, value: string }>
  receivedCredits: number | null
  receivedMaterials: string | null
  destination: string
  destinationLocation: string | null
  destinationSystem: string | null
  expiry: string
  expiryAt: string | null
  faction: string
  id: number
  incomplete: boolean
  progress: string
  provenance: string
  reward: string
  rewardCredits: number | null
  status: MissionStatus
  statusTone: StatusTone
  title: string
}

export interface ActivitiesViewModel {
  active: MissionViewModel[]
  all: MissionViewModel[]
  snapshotAt: string | null
  summary: MissionsResponse['summary']
  updatedAt: string | null
}

export function createActivitiesViewModel(response: MissionsResponse): ActivitiesViewModel {
  const all = response.missions.map(createMissionViewModel)
  return {
    active: all.filter(mission => mission.status === 'active'),
    all,
    snapshotAt: response.snapshotAt,
    summary: response.summary,
    updatedAt: latestTimestamp(response.snapshotAt, ...response.missions.map(mission => mission.updatedAt))
  }
}

function latestTimestamp(...timestamps: Array<string | null | undefined>): string | null {
  return timestamps.filter((timestamp): timestamp is string => Boolean(timestamp)).sort().at(-1) ?? null
}

export function createMissionViewModel(mission: Mission): MissionViewModel {
  const details: MissionViewModel['details'] = []
  const add = (label: string, value: string | null) => {
    if (value !== null) details.push({ label, value })
  }
  const { briefing } = mission
  if (briefing.onFoot) {
    add('Activity', briefing.activity ?? 'On foot · activity unknown')
    add('Known conditions', briefing.conditions.join(' · ') || 'Not observed')
  }
  add('Target', mission.target)
  add('Target type', mission.targetType)
  add('Target faction', mission.targetFaction)
  if (mission.commodity) add(briefing.onFoot ? 'Required item' : 'Cargo',
    `${mission.commodity}${mission.commodityCount === null ? '' : ` × ${mission.commodityCount}`}`)
  if (mission.killCount !== null) add('Required kills', String(mission.killCount))
  if (mission.progress.required !== null) add('Delivery progress',
    `${mission.progress.delivered ?? 'Unknown'} / ${mission.progress.required}`)
  for (const store of ['backpack', 'shipLocker'] as const) {
    const at = briefing.inventory[store === 'backpack' ? 'backpackAt' : 'shipLockerAt']
    const items = briefing.inventory.items.filter(item => item.store === store)
    if (briefing.onFoot || items.length > 0) add(store === 'backpack' ? 'Observed backpack items' : 'Observed locker items',
      at === null ? 'Not observed' : `${items.map(item => `${item.label ?? item.id} × ${item.count}`).join(' · ') || 'No tagged items'} · ${formatPhoenixDateTime(at)}`)
  }
  return {
    details,
    receivedCredits: mission.receivedRewards?.credits ?? null,
    receivedMaterials: mission.receivedRewards?.materials === null || !mission.receivedRewards
      ? null
      : mission.receivedRewards.materials.map(item => `${item.label ?? item.id} × ${item.count}`).join(' · ') || 'None reported',
    accepted: mission.acceptedAt ? formatPhoenixDateTime(mission.acceptedAt) : 'Not observed',
    destination: [mission.destinationSystem, mission.destinationStation ?? mission.destinationSettlement].filter(Boolean).join(' / ') || '—',
    destinationLocation: mission.destinationStation ?? mission.destinationSettlement,
    destinationSystem: mission.destinationSystem,
    expiry: mission.expiry ? formatPhoenixDateTime(mission.expiry) : '—',
    expiryAt: mission.expiry,
    faction: mission.faction ?? '—',
    id: mission.id,
    incomplete: mission.provenance.details === 'partial',
    progress: mission.progress.required === null ? '—' : `${mission.progress.delivered ?? 'Unknown'} / ${mission.progress.required}`,
    provenance: mission.provenance.sources.join(' · ') || 'No source recorded',
    reward: formatPhoenixCredits(mission.reward),
    rewardCredits: mission.reward,
    status: mission.status,
    statusTone: toneForStatus(mission.status),
    title: mission.localizedName ?? readableMissionName(mission.name) ?? `Mission ${mission.id}`
  }
}

function readableMissionName(name: string | null): string | undefined {
  return name?.replace(/^Mission_/u, '').replace(/_name$/u, '').replaceAll('_', ' ')
}

function toneForStatus(status: MissionStatus): StatusTone {
  switch (status) {
    case 'active': return 'information'
    case 'completed': return 'positive'
    case 'failed':
    case 'abandoned': return 'danger'
    case 'unknown': return 'muted'
  }
}
