import {
  PersonalEquipmentSpecialistsResponseSchema,
  type CommanderEngineerProgress,
  type PersonalEquipmentSpecialistsResponse
} from '@phoenix/contracts'
import type { EngineeringCatalogue, PersonalEquipmentCatalogue } from '@phoenix/elite'
import type { PersonalEquipmentSpecialistsReader } from '../domain/personal-equipment-specialists.js'
import type { RuntimeStateReader } from '../domain/runtime-state.js'

export class PersonalEquipmentSpecialistsService implements PersonalEquipmentSpecialistsReader {
  public constructor (
    private readonly catalogue: PersonalEquipmentCatalogue,
    private readonly engineeringCatalogue: EngineeringCatalogue,
    private readonly runtimeState: RuntimeStateReader
  ) {}

  public getSpecialists (): PersonalEquipmentSpecialistsResponse {
    const catalogue = this.catalogue.getSnapshot()
    const runtime = this.runtimeState.getCurrent()
    const locations = new Map(
      this.engineeringCatalogue.listEngineers()
        .filter(engineer => engineer.kind === 'personal')
        .map(engineer => [engineer.id, engineer])
    )
    return PersonalEquipmentSpecialistsResponseSchema.parse({
      schemaVersion: 2,
      catalogueVersion: catalogue.catalogueVersion,
      generatedAt: catalogue.generatedAt,
      sources: catalogue.sources.map(source => ({
        name: source.name,
        repository: source.repository,
        revision: source.revision,
        license: source.license,
        retrievedAt: source.retrievedAt
      })),
      specialists: catalogue.engineers.map(engineer => {
        const location = locations.get(engineer.frontierEngineerId)
        if (!location) throw new Error(`Personal-equipment specialist ${engineer.displayName} has no location record.`)
        const progress = runtime.commander.engineers.find(candidate => candidate.id === engineer.frontierEngineerId)
        return {
          id: engineer.id,
          frontierEngineerId: engineer.frontierEngineerId,
          name: engineer.displayName,
          access: access(progress, runtime.commander.engineerAccessCoverage),
          location: {
            systemName: location.systemName,
            systemAddress: location.systemAddress,
            marketId: location.marketId,
            distanceLy: distance(runtime.system.position, location.systemPosition),
            evidence: 'external_catalogue'
          },
          modifications: catalogue.modifications
            .filter(modification => modification.engineerIds.includes(engineer.id))
            .map(modification => ({
              id: modification.id,
              name: modification.displayName,
              targetKind: modification.targetKind,
              engineeringTechnology: modification.engineeringTechnology
            }))
            .sort((left, right) => left.targetKind.localeCompare(right.targetKind) || left.name.localeCompare(right.name))
        }
      }).sort((left, right) => left.name.localeCompare(right.name))
    })
  }
}

function access (
  progress: CommanderEngineerProgress | undefined,
  coverage: 'unknown' | 'partial' | 'complete'
): PersonalEquipmentSpecialistsResponse['specialists'][number]['access'] {
  if (!progress) return {
    state: coverage === 'complete' ? 'locked' : 'unknown',
    reportedStatus: null,
    evidence: 'not_observed'
  }
  const state = normalizedAccessState(progress.status)
  return {
    state,
    reportedStatus: progress.status,
    evidence: 'elite_journal'
  }
}

function normalizedAccessState (
  status: string | null
): PersonalEquipmentSpecialistsResponse['specialists'][number]['access']['state'] {
  const normalized = status?.trim().toLocaleLowerCase()
  if (
    normalized === 'known' ||
    normalized === 'invited' ||
    normalized === 'acquainted' ||
    normalized === 'unlocked' ||
    normalized === 'barred'
  ) return normalized
  return 'unknown'
}

function distance (
  left: [number, number, number] | null,
  right: [number, number, number] | null
): number | null {
  return left && right ? Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]) : null
}
