import type { JsonObject, LocalTool } from '@judus/llm-client'
import type { MissionDataReader } from '../../domain/missions.js'
import { boundedLimit, json, optionalIntegerArgument, optionalStringArgument, output } from './tool-support.js'

export class OperationsListMissionsTool implements LocalTool {
  public readonly definition = {
    annotations: { readOnly: true },
    description: 'List the commander\'s reconstructed Frontier missions. Records explicitly report when acceptance details are incomplete; use status to request active, completed, failed, abandoned, unknown, or all missions.',
    inputSchema: {
      additionalProperties: false,
      properties: {
        limit: { maximum: 50, minimum: 1, type: 'integer' },
        status: { enum: ['active', 'completed', 'failed', 'abandoned', 'unknown', 'all'], type: 'string' }
      },
      type: 'object'
    },
    name: 'operations.list_missions'
  }

  public constructor (private readonly missions: MissionDataReader) {}

  public readonly execute = (arguments_: JsonObject) => {
    const response = this.missions.getMissions()
    const status = optionalStringArgument(arguments_, 'status') ?? 'active'
    const limit = boundedLimit(optionalIntegerArgument(arguments_, 'limit'), 20, 50)
    const missions = response.missions
      .filter(mission => status === 'all' || mission.status === status)
      .slice(0, limit)
    const text = missions.length === 0
      ? `No ${status === 'all' ? '' : `${status} `}missions are retained.`
      : missions.map(mission => {
          const name = mission.localizedName ?? mission.name ?? `Mission ${mission.id}`
          const destination = [mission.destinationSystem, mission.destinationStation ?? mission.destinationSettlement].filter(Boolean).join(' / ')
          const progress = mission.progress.required === null
            ? ''
            : `; delivered ${mission.progress.delivered ?? 0}/${mission.progress.required}`
          const incomplete = mission.provenance.details === 'partial' ? '; details incomplete' : ''
          return `- ${name}: ${mission.status}${destination ? `; ${destination}` : ''}${progress}${incomplete}`
        }).join('\n')
    return output(text, json({ missions, summary: response.summary }))
  }
}
