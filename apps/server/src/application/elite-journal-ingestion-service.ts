import { randomUUID } from 'node:crypto'
import type {
  CurrentLocation,
  CurrentShip,
  CurrentSystem,
  CommanderEngineerProgress,
  EngineeringMaterialAdjustment,
  EngineeringMaterialConsumption,
  EngineeringMaterials,
  FactionSummary,
  GameEventEnvelope,
  NamedGameValue,
  ShipModule
} from '@phoenix/contracts'
import {
  parseCargoInventory,
  parseMicroResourceInventory,
  type EliteJournalEvent
} from '@phoenix/elite'
import type { GameEventIngestor } from '../domain/runtime-state.js'

type EventCandidate = Omit<GameEventEnvelope, 'id' | 'ingestedAt' | 'schemaVersion' | 'source'>

export class EliteJournalIngestionService {
  public constructor (private readonly events: GameEventIngestor) {}

  public ingest (event: EliteJournalEvent): GameEventEnvelope[] {
    const ingestedAt = new Date().toISOString()
    return this.map(event).map(candidate => this.events.ingest({
      ...candidate,
      schemaVersion: 1,
      id: randomUUID(),
      ingestedAt,
      source: 'journal'
    } as GameEventEnvelope))
  }

  private map (event: EliteJournalEvent): EventCandidate[] {
    const gameTimestamp = event.timestamp
    const candidates: EventCandidate[] = []

    if (event.event === 'Commander') {
      const name = stringValue(event, 'Name')
      if (name) candidates.push({ type: 'commander.identity_changed', gameTimestamp, payload: { name } })
    }

    if (event.event === 'Rank') {
      candidates.push({
        type: 'commander.ranks_changed',
        gameTimestamp,
        payload: rankValues(event)
      })
    }

    if (event.event === 'Progress') {
      candidates.push({
        type: 'commander.rank_progress_changed',
        gameTimestamp,
        payload: rankValues(event)
      })
    }

    if (event.event === 'EngineerProgress') {
      candidates.push({
        type: 'commander.engineers_changed',
        gameTimestamp,
        payload: mapEngineerProgress(event.Engineers)
      })
    }

    if (event.event === 'Reputation') {
      candidates.push({
        type: 'commander.reputation_changed',
        gameTimestamp,
        payload: {
          empire: numberValue(event, 'Empire'),
          federation: numberValue(event, 'Federation'),
          independent: numberValue(event, 'Independent'),
          alliance: numberValue(event, 'Alliance')
        }
      })
    }

    if (event.event === 'Statistics') {
      candidates.push({
        type: 'commander.statistics_changed',
        gameTimestamp,
        payload: {
          updatedAt: event.timestamp,
          groups: statisticsGroups(event)
        }
      })
    }

    const system = mapSystem(event)
    if (system) candidates.push({ type: 'system.changed', gameTimestamp, payload: system })

    const location = mapLocation(event)
    if (location) candidates.push({ type: 'location.changed', gameTimestamp, payload: location })

    const ship = mapShip(event)
    if (ship) candidates.push({ type: 'ship.loadout_changed', gameTimestamp, payload: ship })

    if (event.event === 'Cargo' && Array.isArray(event.Inventory)) {
      candidates.push({ type: 'inventory.cargo_changed', gameTimestamp, payload: parseCargoInventory(event) })
    }

    if (event.event === 'ShipLocker') {
      candidates.push({
        type: 'inventory.ship_locker_changed',
        gameTimestamp,
        payload: parseMicroResourceInventory(event)
      })
    }

    if (event.event === 'Backpack' || event.event === 'BackpackMaterials') {
      candidates.push({
        type: 'inventory.backpack_changed',
        gameTimestamp,
        payload: parseMicroResourceInventory(event)
      })
    }

    const materials = mapMaterials(event)
    if (materials) candidates.push({ type: 'inventory.materials_changed', gameTimestamp, payload: materials })
    for (const adjustment of mapMaterialAdjustments(event)) {
      candidates.push({ type: 'inventory.material_adjusted', gameTimestamp, payload: adjustment })
    }
    for (const consumption of mapMaterialConsumption(event)) {
      candidates.push({ type: 'inventory.material_consumed', gameTimestamp, payload: consumption })
    }

    return candidates
  }
}

function statisticsGroups (event: EliteJournalEvent): Record<string, Record<string, number>> {
  return Object.fromEntries(
    Object.entries(event).flatMap(([group, candidate]) => {
      if (!isRecord(candidate)) return []
      const metrics = Object.fromEntries(
        Object.entries(candidate).filter((entry): entry is [string, number] => (
          typeof entry[1] === 'number' && Number.isFinite(entry[1])
        ))
      )
      return Object.keys(metrics).length > 0 ? [[group, metrics]] : []
    })
  )
}

function mapMaterialConsumption (event: EliteJournalEvent): EngineeringMaterialConsumption[] {
  if (!['EngineerCraft', 'Synthesis'].includes(event.event) || !Array.isArray(event.Ingredients)) return []
  return event.Ingredients.map(item => {
    if (!isRecord(item)) return null
    const id = stringValue(item, 'Name')
    const count = integerValue(item, 'Count')
    return id && count !== null && count > 0
      ? { updatedAt: event.timestamp, id, label: stringValue(item, 'Name_Localised'), count }
      : null
  }).filter((item): item is EngineeringMaterialConsumption => item !== null)
}

function mapEngineerProgress (candidate: unknown): CommanderEngineerProgress[] {
  if (!Array.isArray(candidate)) return []
  return candidate.map(item => {
    if (!isRecord(item)) return null
    const id = integerValue(item, 'EngineerID')
    const name = stringValue(item, 'Engineer')
    if (id === null || !name) return null
    return {
      id,
      name,
      status: stringValue(item, 'Progress'),
      rank: integerValue(item, 'Rank') ?? 0,
      rankProgress: numberValue(item, 'RankProgress') ?? 0
    }
  }).filter((item): item is CommanderEngineerProgress => item !== null)
}

function mapMaterials (event: EliteJournalEvent): EngineeringMaterials | null {
  if (event.event !== 'Materials') return null
  return {
    updatedAt: event.timestamp,
    raw: mapMaterialList(event.Raw),
    manufactured: mapMaterialList(event.Manufactured),
    encoded: mapMaterialList(event.Encoded)
  }
}

function mapMaterialList (candidate: unknown): EngineeringMaterials['raw'] {
  return Array.isArray(candidate)
    ? candidate
        .map(item => {
          if (!isRecord(item)) return null
          const id = stringValue(item, 'Name')
          const count = integerValue(item, 'Count')
          return id && count !== null
            ? { id, label: stringValue(item, 'Name_Localised'), count }
            : null
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : []
}

function mapMaterialAdjustments (event: EliteJournalEvent): EngineeringMaterialAdjustment[] {
  if (event.event === 'MaterialCollected' || event.event === 'MaterialDiscarded') {
    const adjustment = materialAdjustment(
      event,
      stringValue(event, 'Category'),
      stringValue(event, 'Name'),
      stringValue(event, 'Name_Localised'),
      integerValue(event, 'Count'),
      event.event === 'MaterialCollected' ? 1 : -1
    )
    return adjustment ? [adjustment] : []
  }
  if (event.event !== 'MaterialTrade') return []
  const fallbackCategory = stringValue(event, 'TraderType')
  return [
    materialTradeAdjustment(event, event.Paid, fallbackCategory, -1),
    materialTradeAdjustment(event, event.Received, fallbackCategory, 1)
  ].filter((item): item is EngineeringMaterialAdjustment => item !== null)
}

function materialTradeAdjustment (
  event: EliteJournalEvent,
  candidate: unknown,
  fallbackCategory: string | null,
  direction: 1 | -1
): EngineeringMaterialAdjustment | null {
  if (!isRecord(candidate)) return null
  return materialAdjustment(
    event,
    stringValue(candidate, 'Category') ?? fallbackCategory,
    stringValue(candidate, 'Material'),
    stringValue(candidate, 'Material_Localised'),
    integerValue(candidate, 'Quantity'),
    direction
  )
}

function materialAdjustment (
  event: EliteJournalEvent,
  categoryValue: string | null,
  id: string | null,
  label: string | null,
  count: number | null,
  direction: 1 | -1
): EngineeringMaterialAdjustment | null {
  const category = normalizeMaterialCategory(categoryValue)
  if (!category || !id || count === null || count === 0) return null
  return { updatedAt: event.timestamp, category, id, label, delta: count * direction }
}

function normalizeMaterialCategory (
  value: string | null
): EngineeringMaterialAdjustment['category'] | null {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'raw' || normalized === 'manufactured' || normalized === 'encoded') return normalized
  return null
}

function mapShip (event: EliteJournalEvent): CurrentShip | null {
  if (event.event !== 'Loadout') return null
  const typeId = stringValue(event, 'Ship')
  if (!typeId) return null
  const fuelMain = isRecord(event.FuelCapacity) ? numberValue(event.FuelCapacity, 'Main') : null
  const fuelReserve = isRecord(event.FuelCapacity) ? numberValue(event.FuelCapacity, 'Reserve') : null
  const fuelCapacity = fuelMain !== null && fuelReserve !== null
    ? { main: fuelMain, reserve: fuelReserve }
    : null

  return {
    id: integerValue(event, 'ShipID'),
    typeId,
    definition: null,
    name: stringValue(event, 'ShipName'),
    identifier: stringValue(event, 'ShipIdent'),
    hullHealth: numberValue(event, 'HullHealth'),
    hullValue: numberValue(event, 'HullValue'),
    modulesValue: numberValue(event, 'ModulesValue'),
    unladenMass: numberValue(event, 'UnladenMass'),
    cargoCapacity: numberValue(event, 'CargoCapacity'),
    maxJumpRange: numberValue(event, 'MaxJumpRange'),
    fuelCapacity,
    rebuy: numberValue(event, 'Rebuy'),
    modules: arrayValue(event, 'Modules')
      .map(mapModule)
      .filter((module): module is ShipModule => module !== null)
  }
}

function mapModule (candidate: unknown): ShipModule | null {
  if (!isRecord(candidate)) return null
  const slotId = stringValue(candidate, 'Slot')
  const moduleId = stringValue(candidate, 'Item')
  if (!slotId || !moduleId) return null
  const clip = integerValue(candidate, 'AmmoInClip')
  const reserve = integerValue(candidate, 'AmmoInHopper')

  return {
    slotId,
    slotGroup: classifySlot(slotId),
    slotSize: deriveSlotSize(slotId, moduleId),
    expectedSlot: null,
    moduleId,
    moduleSize: deriveModuleSize(moduleId),
    moduleClass: regexInteger(moduleId, /_class(\d+)/i),
    definition: null,
    enabled: booleanValue(candidate, 'On'),
    priority: integerValue(candidate, 'Priority'),
    health: numberValue(candidate, 'Health'),
    value: numberValue(candidate, 'Value'),
    ammo: clip !== null || reserve !== null ? { clip, reserve } : null,
    engineering: mapEngineering(candidate.Engineering)
  }
}

function mapEngineering (candidate: unknown): ShipModule['engineering'] {
  if (!isRecord(candidate)) return null
  return {
    engineer: stringValue(candidate, 'Engineer'),
    engineerId: integerValue(candidate, 'EngineerID'),
    blueprintId: integerValue(candidate, 'BlueprintID'),
    blueprintName: stringValue(candidate, 'BlueprintName'),
    level: integerValue(candidate, 'Level'),
    quality: numberValue(candidate, 'Quality'),
    experimentalEffect: stringValue(candidate, 'ExperimentalEffect'),
    experimentalEffectLabel: stringValue(candidate, 'ExperimentalEffect_Localised'),
    modifiers: arrayValue(candidate, 'Modifiers')
      .map(modifier => {
        if (!isRecord(modifier)) return null
        const label = stringValue(modifier, 'Label')
        if (!label) return null
        return {
          label,
          value: numberValue(modifier, 'Value'),
          originalValue: numberValue(modifier, 'OriginalValue'),
          lessIsGood: booleanValue(modifier, 'LessIsGood')
        }
      })
      .filter((modifier): modifier is NonNullable<typeof modifier> => modifier !== null)
  }
}

function classifySlot (slotId: string): ShipModule['slotGroup'] {
  if (['Armour', 'PowerPlant', 'MainEngines', 'FrameShiftDrive', 'LifeSupport', 'PowerDistributor', 'Radar', 'FuelTank'].includes(slotId)) return 'core'
  if (/^TinyHardpoint/i.test(slotId)) return 'utility'
  if (/Hardpoint/i.test(slotId)) return 'hardpoint'
  if (/^(Slot\d+_Size\d+|LimpetController|FighterBay|PlanetaryApproachSuite)/i.test(slotId)) return 'optional'
  if (['VesselVoice', 'ShipCockpit', 'CargoHatch'].includes(slotId)) return 'ship'
  return 'other'
}

function deriveSlotSize (slotId: string, moduleId: string): number | null {
  return regexInteger(slotId, /_Size(\d+)/i) ?? deriveModuleSize(moduleId)
}

function deriveModuleSize (moduleId: string): number | null {
  const numeric = regexInteger(moduleId, /_size(\d+)/i)
  if (numeric !== null && numeric > 0) return numeric
  const namedSize = moduleId.match(/_(small|medium|large|huge)(?:_|$)/i)?.[1]?.toLowerCase()
  return namedSize ? ({ small: 1, medium: 2, large: 3, huge: 4 } as const)[namedSize as 'small' | 'medium' | 'large' | 'huge'] : null
}

function regexInteger (value: string, pattern: RegExp): number | null {
  const matched = value.match(pattern)?.[1]
  if (!matched) return null
  const parsed = Number.parseInt(matched, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function mapLocation (event: EliteJournalEvent): CurrentLocation | null {
  const bodyName = stringValue(event, 'Body') ?? stringValue(event, 'BodyName')
  const stationName = stringValue(event, 'StationName')
  const station = stationName ? stationPlace(event, stationName) : null
  const body = bodyName && stringValue(event, 'BodyType') !== 'Station'
    ? {
        kind: 'body' as const,
        name: bodyName,
        id: integerValue(event, 'BodyID'),
        type: stringValue(event, 'BodyType')
      }
    : null

  switch (event.event) {
    case 'Location':
      return {
        state: event.Docked === true ? 'docked' : 'unknown',
        place: event.Docked === true ? station : body
      }
    case 'FSDJump':
    case 'CarrierJump':
      return { state: 'in_space', place: body }
    case 'Docked':
      return { state: 'docked', place: station }
    case 'Undocked':
      return { state: 'in_space', place: null }
    case 'SupercruiseEntry':
      return { state: 'supercruise', place: null }
    case 'SupercruiseExit':
      return { state: 'in_space', place: body }
    case 'Touchdown':
      return { state: 'landed', place: body }
    case 'Liftoff':
      return { state: 'in_space', place: body }
    case 'Disembark':
      return { state: 'on_foot', place: station ?? body }
    case 'Embark':
      return {
        state: event.SRV === true ? 'in_srv' : 'in_space',
        place: station ?? body
      }
    case 'StartJump':
      if (event.JumpType === 'Hyperspace') {
        return { state: 'hyperspace', place: null }
      }
      if (event.JumpType === 'Supercruise') {
        return { state: 'supercruise', place: null }
      }
      return null
    default:
      return null
  }
}

function mapSystem (event: EliteJournalEvent): CurrentSystem | null {
  if (!['Location', 'FSDJump', 'CarrierJump'].includes(event.event)) return null
  const name = stringValue(event, 'StarSystem')
  if (!name) return null
  const controllingFaction = factionSummary(event.SystemFaction)
  const factions = arrayValue(event, 'Factions')
    .map(factionSummary)
    .filter((faction): faction is FactionSummary => faction !== null)
  const powers = arrayValue(event, 'Powers')
    .filter((power): power is string => typeof power === 'string' && power.trim().length > 0)
    .map(power => power.trim())
  const controllingPower = stringValue(event, 'ControllingPower')
  const powerplayState = stringValue(event, 'PowerplayState')

  return {
    name,
    address: integerValue(event, 'SystemAddress'),
    position: coordinateValue(event, 'StarPos'),
    allegiance: stringValue(event, 'SystemAllegiance'),
    government: namedValue(event, 'SystemGovernment'),
    primaryEconomy: namedValue(event, 'SystemEconomy'),
    secondaryEconomy: namedValue(event, 'SystemSecondEconomy'),
    security: namedValue(event, 'SystemSecurity'),
    population: integerValue(event, 'Population'),
    controllingFaction,
    factions,
    powerplay: controllingPower || powerplayState || powers.length > 0
      ? {
          controllingPower,
          powers,
          state: powerplayState,
          controlProgress: numberValue(event, 'PowerplayStateControlProgress'),
          reinforcement: numberValue(event, 'PowerplayStateReinforcement'),
          undermining: numberValue(event, 'PowerplayStateUndermining')
        }
      : null
  }
}

function stationPlace (event: EliteJournalEvent, name: string): Extract<CurrentLocation['place'], { kind: 'station' }> {
  return {
    kind: 'station',
    name,
    type: stringValue(event, 'StationType'),
    marketId: integerValue(event, 'MarketID'),
    faction: factionSummary(event.StationFaction),
    government: namedValue(event, 'StationGovernment'),
    primaryEconomy: namedValue(event, 'StationEconomy'),
    economies: arrayValue(event, 'StationEconomies')
      .map(candidate => {
        if (!isRecord(candidate)) return null
        const economy = namedValue(candidate, 'Name')
        return economy
          ? { economy, proportion: numberValue(candidate, 'Proportion') }
          : null
      })
      .filter((economy): economy is { economy: NamedGameValue, proportion: number | null } => economy !== null),
    services: arrayValue(event, 'StationServices')
      .filter((service): service is string => typeof service === 'string' && service.trim().length > 0)
      .map(service => service.trim())
  }
}

function factionSummary (candidate: unknown): FactionSummary | null {
  if (!isRecord(candidate)) return null
  const name = stringValue(candidate, 'Name')
  if (!name) return null
  return {
    name,
    state: stringValue(candidate, 'FactionState'),
    government: stringValue(candidate, 'Government'),
    allegiance: stringValue(candidate, 'Allegiance'),
    influence: numberValue(candidate, 'Influence'),
    happiness: namedValue(candidate, 'Happiness'),
    reputation: numberValue(candidate, 'MyReputation')
  }
}

function namedValue (candidate: Record<string, unknown>, key: string): NamedGameValue | null {
  const id = stringValue(candidate, key)
  if (!id) return null
  return {
    id,
    label: stringValue(candidate, `${key}_Localised`)
  }
}

function rankValues (event: EliteJournalEvent) {
  return {
    combat: integerValue(event, 'Combat'),
    trade: integerValue(event, 'Trade'),
    exploration: integerValue(event, 'Explore'),
    federation: integerValue(event, 'Federation'),
    empire: integerValue(event, 'Empire'),
    cqc: integerValue(event, 'CQC'),
    mercenary: integerValue(event, 'Soldier'),
    exobiologist: integerValue(event, 'Exobiologist')
  }
}

function stringValue (candidate: Record<string, unknown>, key: string): string | null {
  const value = candidate[key]
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function integerValue (candidate: Record<string, unknown>, key: string): number | null {
  const value = candidate[key]
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

function numberValue (candidate: Record<string, unknown>, key: string): number | null {
  const value = candidate[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function booleanValue (candidate: Record<string, unknown>, key: string): boolean | null {
  const value = candidate[key]
  if (typeof value === 'boolean') return value
  if (value === 1) return true
  if (value === 0) return false
  return null
}

function arrayValue (candidate: Record<string, unknown>, key: string): unknown[] {
  const value = candidate[key]
  return Array.isArray(value) ? value : []
}

function coordinateValue (
  candidate: Record<string, unknown>,
  key: string
): [number, number, number] | null {
  const value = candidate[key]
  if (!Array.isArray(value) || value.length !== 3) return null
  if (!value.every(coordinate => typeof coordinate === 'number' && Number.isFinite(coordinate))) return null
  return [value[0] as number, value[1] as number, value[2] as number]
}

function isRecord (candidate: unknown): candidate is Record<string, unknown> {
  return typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)
}
