import {
  PersonalEquipmentReportResponseSchema,
  type CommanderEquipmentResponse,
  type CommanderSuit,
  type CommanderWeapon,
  type PersonalEquipmentPlannerEquipment,
  type PersonalEquipmentReportResponse
} from '@phoenix/contracts'
import type { CommanderEquipmentReader } from '../domain/commander-equipment.js'
import type { PersonalEquipmentPlanner } from '../domain/personal-equipment-planner.js'
import type { PersonalEquipmentReportReader } from '../domain/personal-equipment-report.js'
import type { PersonalEquipmentSpecialistsReader } from '../domain/personal-equipment-specialists.js'
import type { PersonalEquipmentUpgradesReader } from '../domain/personal-equipment-upgrades.js'
import type { PersonalMaterialInventoryReader } from '../domain/personal-materials.js'

type ObservedEquipment = CommanderSuit | CommanderWeapon

export class PersonalEquipmentReportService implements PersonalEquipmentReportReader {
  public constructor (
    private readonly equipment: CommanderEquipmentReader,
    private readonly materials: PersonalMaterialInventoryReader,
    private readonly upgrades: PersonalEquipmentUpgradesReader,
    private readonly specialists: PersonalEquipmentSpecialistsReader,
    private readonly planner: PersonalEquipmentPlanner
  ) {}

  public getReport (): PersonalEquipmentReportResponse {
    const equipment = this.equipment.getEquipment()
    const materials = this.materials.getInventory()
    const upgrades = this.upgrades.getUpgrades()
    const specialists = this.specialists.getSpecialists()
    const planner = this.planner.getOptions()
    assertSameCatalogue(upgrades.catalogueVersion, specialists.catalogueVersion, planner.catalogueVersion)

    const resolved = resolvedInstances(planner.equipment)
    const specialistIds = specialistIdsByName(specialists.specialists)
    const unknowns: PersonalEquipmentReportResponse['unknowns'] = []
    if (materials.stores.shipLockerUpdatedAt === null) unknowns.push({
      kind: 'inventory_snapshot',
      reference: 'ship-locker',
      message: 'Ship Locker inventory has not been observed.'
    })
    if (materials.stores.backpackUpdatedAt === null) unknowns.push({
      kind: 'inventory_snapshot',
      reference: 'backpack',
      message: 'Backpack inventory has not been observed.'
    })

    const ownedEquipment = [
      ...equipment.suits.map(item => reportEquipment('suit', item, resolved, unknowns)),
      ...equipment.weapons.map(item => reportEquipment('weapon', item, resolved, unknowns))
    ]

    return PersonalEquipmentReportResponseSchema.parse({
      schemaVersion: 1,
      catalogueVersion: upgrades.catalogueVersion,
      catalogueGeneratedAt: upgrades.generatedAt,
      catalogueSources: upgrades.sources,
      coverage: {
        ownership: equipment.ownershipCoverage,
        equipmentUpdatedAt: equipment.updatedAt,
        materialsUpdatedAt: materials.updatedAt,
        shipLockerUpdatedAt: materials.stores.shipLockerUpdatedAt,
        backpackUpdatedAt: materials.stores.backpackUpdatedAt,
        materialInventoryComplete: materials.stores.shipLockerUpdatedAt !== null && materials.stores.backpackUpdatedAt !== null
      },
      currentLoadoutId: equipment.currentLoadoutId,
      loadouts: equipment.loadouts.map(loadout => ({
        id: loadout.id,
        name: loadout.name,
        current: loadout.id === equipment.currentLoadoutId,
        suitId: loadout.suitId,
        weapons: loadout.slots.map(slot => ({ slot: slot.slot, weaponId: slot.weaponId }))
      })),
      ownedEquipment,
      materials: materials.groups.flatMap(group => group.items),
      equipmentDefinitions: planner.equipment.map(definition => ({
        id: definition.id,
        name: definition.name,
        kind: definition.kind,
        grades: definition.grades,
        compatibleModificationIds: definition.modifications.map(modification => modification.id)
      })),
      gradeUpgradePaths: upgrades.gradeUpgradePaths.map(path => ({
        id: path.id,
        targetKind: path.targetKind,
        targetId: path.targetId,
        name: path.name,
        equipmentNames: path.equipmentNames,
        fromGrade: path.fromGrade,
        toGrade: path.toGrade,
        steps: path.steps.map(step => ({
          id: step.id,
          fromGrade: step.fromGrade,
          toGrade: step.toGrade,
          modificationSlots: step.resultingModificationSlots,
          credits: step.credits,
          ingredients: step.ingredients
        }))
      })),
      modifications: upgrades.modifications.map(modification => ({
        id: modification.id,
        name: modification.name,
        targetKind: modification.targetKind,
        engineeringTechnology: modification.engineeringTechnology,
        specialistIds: modification.engineers.map(name => requiredSpecialistId(specialistIds, name)),
        credits: modification.credits,
        ingredients: modification.ingredients
      })),
      specialists: specialists.specialists.map(specialist => ({
        id: specialist.id,
        name: specialist.name,
        access: specialist.access,
        location: {
          systemName: specialist.location.systemName,
          distanceLy: specialist.location.distanceLy,
          evidence: specialist.location.evidence
        },
        modificationIds: specialist.modifications.map(modification => modification.id)
      })),
      unknowns
    })
  }
}

interface ResolvedInstance {
  definition: PersonalEquipmentPlannerEquipment
  instance: PersonalEquipmentPlannerEquipment['observedInstances'][number]
}

function resolvedInstances (definitions: PersonalEquipmentPlannerEquipment[]): Map<string, ResolvedInstance> {
  const result = new Map<string, ResolvedInstance>()
  for (const definition of definitions) {
    for (const instance of definition.observedInstances) {
      result.set(equipmentKey(definition.kind, instance.instanceId), { definition, instance })
    }
  }
  return result
}

function reportEquipment (
  kind: 'suit' | 'weapon',
  item: ObservedEquipment,
  resolved: ReadonlyMap<string, ResolvedInstance>,
  unknowns: PersonalEquipmentReportResponse['unknowns']
): PersonalEquipmentReportResponse['ownedEquipment'][number] {
  const match = resolved.get(equipmentKey(kind, item.id))
  if (item.grade === null) unknowns.push({
    kind: 'equipment_grade',
    reference: `${kind}:${item.id}`,
    message: `${item.displayName} has no observed grade.`
  })
  if (!match) unknowns.push({
    kind: 'equipment_definition',
    reference: `${kind}:${item.id}`,
    message: `${item.displayName} could not be resolved to the equipment catalogue.`
  })
  for (const modification of match?.instance.installedModifications ?? []) {
    if (modification.id === null) unknowns.push({
      kind: 'installed_modification',
      reference: `${kind}:${item.id}:${modification.symbol}`,
      message: `${modification.name} could not be resolved to the equipment catalogue.`
    })
  }
  const grade = item.grade === null
    ? null
    : match?.definition.grades.find(candidate => candidate.grade === item.grade) ?? null
  const installedModifications = match?.instance.installedModifications ?? item.modifications.map(modification => ({
    id: null,
    symbol: modification.symbol,
    name: modification.displayName
  }))
  const totalSlots = grade?.modificationSlots ?? null
  return {
    kind,
    instanceId: item.id,
    definitionId: match?.definition.id ?? null,
    name: item.displayName,
    grade: item.grade,
    modificationSlots: totalSlots === null ? null : {
      total: totalSlots,
      installed: installedModifications.length,
      remaining: Math.max(0, totalSlots - installedModifications.length)
    },
    installedModifications,
    loadoutIds: item.loadoutIds,
    manufacturer: 'manufacturer' in item ? item.manufacturer : null,
    category: 'category' in item ? item.category : null,
    damageType: 'damageType' in item ? item.damageType : null,
    updatedAt: item.updatedAt
  }
}

function specialistIdsByName (
  specialists: Array<{ id: string, name: string }>
): Map<string, string> {
  const result = new Map<string, string>()
  for (const specialist of specialists) {
    if (result.has(specialist.name)) throw new Error(`Duplicate personal-equipment specialist name ${specialist.name}.`)
    result.set(specialist.name, specialist.id)
  }
  return result
}

function requiredSpecialistId (specialists: ReadonlyMap<string, string>, name: string): string {
  const id = specialists.get(name)
  if (!id) throw new Error(`Personal-equipment modification references unknown specialist ${name}.`)
  return id
}

function assertSameCatalogue (...versions: string[]): void {
  if (new Set(versions).size > 1) throw new Error(`Personal-equipment catalogue versions do not match: ${versions.join(', ')}.`)
}

function equipmentKey (kind: 'suit' | 'weapon', instanceId: number): string {
  return `${kind}:${instanceId}`
}
