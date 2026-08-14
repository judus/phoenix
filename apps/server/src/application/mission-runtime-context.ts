import type { MissionDataReader } from '../domain/missions.js'
import type { RuntimeContextSupplement } from '@phoenix/copilot'

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
      const progress = mission.progress.required === null ? null : `${mission.progress.delivered ?? 0}/${mission.progress.required} delivered`
      lines.push(`- ${name}${destination ? ` · ${destination}` : ''}${progress ? ` · ${progress}` : ''}${mission.expiry ? ` · expires ${mission.expiry}` : ''}${mission.provenance.details === 'partial' ? ' · details incomplete' : ''}`)
    }
    return lines.join('\n')
  }
}
