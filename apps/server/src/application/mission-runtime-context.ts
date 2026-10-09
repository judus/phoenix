import type { MissionDataReader } from '../domain/missions.js'
import type { RuntimeContextSupplement } from '@phoenix/copilot'
import { missionContextDetails } from './mission-context-details.js'

export class MissionRuntimeContext implements RuntimeContextSupplement {
  public constructor (private readonly missions: MissionDataReader) {}

  public render (): string {
    const response = this.missions.getMissions()
    if (response.missions.length === 0) return ''
    const active = response.missions.filter(mission => mission.status === 'active')
    const lines = [
      '### Current Missions',
      `- Summary: ${active.length} active · ${response.summary.completed} completed · ${response.summary.failed} failed · ${response.summary.partial} with incomplete details`
    ]
    for (const mission of active.slice(0, 8)) {
      const name = mission.localizedName ?? mission.name ?? `Mission ${mission.id}`
      const destination = [mission.destinationSystem, mission.destinationStation ?? mission.destinationSettlement].filter(Boolean).join(' / ')
      const details = missionContextDetails(mission)
      lines.push(`- ${name}${destination ? ` · ${destination}` : ''}${details.length ? ` · ${details.join(' · ')}` : ''}${mission.expiry ? ` · expires ${mission.expiry}` : ''}${mission.provenance.details === 'partial' ? ' · details incomplete' : ''}`)
    }
    return lines.join('\n')
  }
}
