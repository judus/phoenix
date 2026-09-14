import type { CommanderLogEntry } from '@phoenix/contracts'
import type { EliteJournalEvent } from '@phoenix/elite'
import type { MissionLookup } from '../../domain/missions.js'
import {
  projectCareerCommanderLogEntry,
  type EngineeringBlueprintDisplayNameResolver
} from './career-commander-log-projector.js'
import { projectFinanceCommanderLogEntry } from './finance-commander-log-projector.js'
import {
  projectFleetCommanderLogEntry,
  type ShipDisplayNameResolver
} from './fleet-commander-log-projector.js'
import { projectMissionCommanderLogEntry } from './mission-commander-log-projector.js'

export interface CommanderLogProjector {
  project(event: EliteJournalEvent): CommanderLogEntry | null
}

export class DefaultCommanderLogProjector implements CommanderLogProjector {
  public constructor (
    private readonly missions: MissionLookup,
    private readonly resolveShipDisplayName: ShipDisplayNameResolver,
    private readonly resolveBlueprintDisplayName: EngineeringBlueprintDisplayNameResolver
  ) {}

  public project (event: EliteJournalEvent): CommanderLogEntry | null {
    return projectMissionCommanderLogEntry(event, this.missions) ??
      projectFinanceCommanderLogEntry(event) ??
      projectFleetCommanderLogEntry(event, this.resolveShipDisplayName) ??
      projectCareerCommanderLogEntry(event, this.resolveBlueprintDisplayName)
  }
}
