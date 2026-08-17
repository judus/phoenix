import type { Mission, MissionStatus, MissionsResponse } from '@phoenix/contracts'
import type { StatusTone } from '@phoenix/ui'

export interface MissionViewModel {
  accepted: string
  cargo: string
  destination: string
  destinationLocation: string | null
  destinationSystem: string | null
  expiry: string
  faction: string
  id: number
  incomplete: boolean
  progress: string
  provenance: string
  reward: string
  status: MissionStatus
  statusTone: StatusTone
  target: string
  title: string
}

export interface ActivitiesViewModel {
  active: MissionViewModel[]
  all: MissionViewModel[]
  summary: MissionsResponse['summary']
}

export function createActivitiesViewModel(response: MissionsResponse): ActivitiesViewModel {
  const all = response.missions.map(createMissionViewModel)
  return {
    active: all.filter(mission => mission.status === 'active'),
    all,
    summary: response.summary
  }
}

export function createMissionViewModel(mission: Mission): MissionViewModel {
  return {
    accepted: mission.acceptedAt ? formatDateTime(mission.acceptedAt) : 'Not observed',
    cargo: mission.commodity
      ? `${mission.commodity}${mission.commodityCount === null ? '' : ` × ${mission.commodityCount}`}`
      : '—',
    destination: [mission.destinationSystem, mission.destinationStation ?? mission.destinationSettlement].filter(Boolean).join(' / ') || '—',
    destinationLocation: mission.destinationStation ?? mission.destinationSettlement,
    destinationSystem: mission.destinationSystem,
    expiry: mission.expiry ? formatDateTime(mission.expiry) : '—',
    faction: mission.faction ?? '—',
    id: mission.id,
    incomplete: mission.provenance.details === 'partial',
    progress: mission.progress.required === null ? '—' : `${mission.progress.delivered ?? 0} / ${mission.progress.required}`,
    provenance: mission.provenance.sources.join(' · ') || 'No source recorded',
    reward: mission.reward === null ? '—' : `${mission.reward.toLocaleString()} CR`,
    status: mission.status,
    statusTone: toneForStatus(mission.status),
    target: [mission.target, mission.targetType, mission.targetFaction].filter(Boolean).join(' / ') || '—',
    title: mission.localizedName ?? readableMissionName(mission.name) ?? `Mission ${mission.id}`
  }
}

function readableMissionName(name: string | null): string | undefined {
  return name?.replace(/^Mission_/u, '').replace(/_name$/u, '').replaceAll('_', ' ')
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value))
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
