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
import { projectActivityCommanderLogEntry } from './activity-commander-log-projector.js'
import { detail, journalInteger, journalText } from './commander-log-event.js'

export interface CommanderLogProjector {
  project(event: EliteJournalEvent): CommanderLogEntry | null
}

export class DefaultCommanderLogProjector implements CommanderLogProjector {
  private shipId: number | null = null
  private session = ''
  private system: string | null = null
  private station: string | null = null
  private marketId: number | null = null
  private readonly bodies = new Map<string, string>()
  public constructor (
    private readonly missions: MissionLookup,
    private readonly resolveShipDisplayName: ShipDisplayNameResolver,
    private readonly resolveBlueprintDisplayName: EngineeringBlueprintDisplayNameResolver,
    private readonly resolveModuleDisplayName: (identifier: string) => string | null = () => null
  ) {}

  public project (event: EliteJournalEvent): CommanderLogEntry | null {
    this.observe(event)
    const marketId = journalInteger(event, 'MarketID')
    const location = marketId !== null && marketId === this.marketId ? detail(this.station, this.system) : null
    const bodyKey = this.bodyKey(event)
    const body = bodyKey ? this.bodies.get(bodyKey) ?? `Body ${event.Body} · System ${event.SystemAddress}` : null
    const entry = projectActivityCommanderLogEntry(event, location, body) ??
      projectMissionCommanderLogEntry(event, this.missions) ??
      projectFinanceCommanderLogEntry(event) ??
      projectFleetCommanderLogEntry(event, this.resolveShipDisplayName) ??
      projectCareerCommanderLogEntry(event, this.resolveBlueprintDisplayName)
    if (!entry || event.event !== 'EngineerCraft' || event.ApplyExperimentalEffect || event.ExperimentalEffect) return entry
    const slot = journalText(event, 'Slot')
    const module = journalText(event, 'Module')
    const blueprintId = journalText(event, 'BlueprintName')
    const engineer = journalText(event, 'Engineer')
    const grade = journalInteger(event, 'Level')
    if (this.shipId === null || !slot || !module || !blueprintId || !engineer || grade === null || grade < 1 || grade > 5) return entry
    const blueprint = journalText(event, 'BlueprintName_Localised') ?? this.resolveBlueprintDisplayName(blueprintId) ?? blueprintId
    const moduleName = journalText(event, 'Module_Localised') ?? this.resolveModuleDisplayName(module)
    const moduleLabel = moduleName ? `${moduleName} (${slot})` : slot
    return {
      ...entry,
      detail: detail(blueprint, moduleLabel, `Grade ${grade}`, engineer),
      engineeringRoll: {
        key: JSON.stringify([this.session, this.shipId, slot, module, blueprintId, engineer]),
        blueprint, module: moduleLabel, engineer, grade
      }
    }
  }

  private bodyKey (event: EliteJournalEvent): string | null {
    const address = journalInteger(event, 'SystemAddress')
    const body = journalInteger(event, 'BodyID') ?? journalInteger(event, 'Body')
    return address !== null && body !== null ? `${address}:${body}` : null
  }

  private observe (event: EliteJournalEvent): void {
    if (event.event === 'Fileheader' || event.event === 'LoadGame') {
      this.session = event.timestamp
      this.shipId = null
      this.system = null
      this.station = null
      this.marketId = null
      this.bodies.clear()
    }
    if (['LoadGame', 'Loadout', 'ShipyardSwap'].includes(event.event)) this.shipId = journalInteger(event, 'ShipID')
    if (['Location', 'FSDJump', 'Docked'].includes(event.event)) {
      this.system = journalText(event, 'StarSystem')
      this.station = event.event === 'Docked' || event.Docked === true ? journalText(event, 'StationName') : null
      this.marketId = this.station ? journalInteger(event, 'MarketID') : null
    }
    if (event.event === 'Undocked') {
      this.station = null
      this.marketId = null
    }
    if (['Undocked', 'Docked', 'ShipyardSwap', 'ModuleBuy', 'ModuleSwap', 'ModuleRetrieve'].includes(event.event)) this.session = event.timestamp
    const key = this.bodyKey(event)
    const name = journalText(event, 'BodyName') ?? (event.event === 'Location' ? journalText(event, 'Body') : null)
    if (key && name) {
      this.bodies.set(key, name)
      if (this.bodies.size > 512) this.bodies.delete(this.bodies.keys().next().value!)
    }
  }
}
