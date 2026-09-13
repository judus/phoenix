import type { CommanderLogEntry, Mission } from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import type { MissionLookup } from '../../domain/missions.js'
import {
  commanderLogEntry,
  detail,
  journalInteger,
  journalLabel,
  journalText
} from './commander-log-event.js'

const missionKinds = {
  MissionAccepted: { kind: 'mission.accepted', title: 'Mission accepted', tone: 'neutral' },
  MissionRedirected: { kind: 'mission.redirected', title: 'Mission redirected', tone: 'neutral' },
  MissionCompleted: { kind: 'mission.completed', title: 'Mission completed', tone: 'positive' },
  MissionFailed: { kind: 'mission.failed', title: 'Mission failed', tone: 'warning' },
  MissionAbandoned: { kind: 'mission.abandoned', title: 'Mission abandoned', tone: 'warning' }
} as const

export function projectMissionCommanderLogEntry (
  event: EliteJournalEvent,
  missions: MissionLookup
): CommanderLogEntry | null {
  const definition = missionKinds[event.event as keyof typeof missionKinds]
  if (!definition) return null
  const missionId = journalInteger(event, 'MissionID')
  if (missionId === null) return null
  const mission = missions.getMission(missionId)
  const name = missionName(event, mission) ?? `Mission ${missionId}`
  const destination = missionDestination(event, mission)
  const reward = event.event === 'MissionCompleted' ? journalInteger(event, 'Reward') : null
  return commanderLogEntry(event, {
    category: 'mission',
    kind: definition.kind,
    title: definition.title,
    detail: detail(name, destination),
    creditDelta: reward !== null && reward > 0 ? reward : null,
    tone: definition.tone
  })
}

function missionName (event: EliteJournalEvent, mission: Mission | null): string | null {
  return mission?.localizedName ?? journalText(event, 'LocalisedName') ?? journalLabel(event, 'Name') ?? mission?.name ?? null
}

function missionDestination (event: EliteJournalEvent, mission: Mission | null): string | null {
  const place = journalText(event, 'NewDestinationStation') ??
    journalText(event, 'DestinationSettlement') ??
    journalText(event, 'DestinationStation') ??
    mission?.destinationSettlement ??
    mission?.destinationStation ??
    null
  const system = journalText(event, 'NewDestinationSystem') ??
    journalText(event, 'DestinationSystem') ??
    mission?.destinationSystem ??
    null
  if (place && system) return `${place}, ${system}`
  return place ?? system
}
