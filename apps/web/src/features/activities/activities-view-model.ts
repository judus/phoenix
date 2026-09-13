import type { Mission, MissionStatus, MissionsResponse } from '@phoenix/contracts'
import type { StatusTone } from '@phoenix/ui'
import { formatPhoenixCredits } from '../../components/phoenix-credits.js'
import { formatPhoenixDateTime } from '../../components/phoenix-date-time.js'

export interface MissionViewModel {
  accepted: string
  cargo: string
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
  target: string
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
  return {
    accepted: mission.acceptedAt ? formatPhoenixDateTime(mission.acceptedAt) : 'Not observed',
    cargo: mission.commodity
      ? `${mission.commodity}${mission.commodityCount === null ? '' : ` × ${mission.commodityCount}`}`
      : '—',
    destination: [mission.destinationSystem, mission.destinationStation ?? mission.destinationSettlement].filter(Boolean).join(' / ') || '—',
    destinationLocation: mission.destinationStation ?? mission.destinationSettlement,
    destinationSystem: mission.destinationSystem,
    expiry: mission.expiry ? formatPhoenixDateTime(mission.expiry) : '—',
    expiryAt: mission.expiry,
    faction: mission.faction ?? '—',
    id: mission.id,
    incomplete: mission.provenance.details === 'partial',
    progress: mission.progress.required === null ? '—' : `${mission.progress.delivered ?? 0} / ${mission.progress.required}`,
    provenance: mission.provenance.sources.join(' · ') || 'No source recorded',
    reward: formatPhoenixCredits(mission.reward),
    rewardCredits: mission.reward,
    status: mission.status,
    statusTone: toneForStatus(mission.status),
    target: [mission.target, mission.targetType, mission.targetFaction].filter(Boolean).join(' / ') || '—',
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
