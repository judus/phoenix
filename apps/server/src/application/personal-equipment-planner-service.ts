import {
  PersonalEquipmentPlannerOptionsResponseSchema,
  PersonalEquipmentPlanPreviewResponseSchema,
  type CommanderEquipmentModification,
  type CommanderSuit,
  type CommanderWeapon,
  type PersonalEquipmentPlannerOptionsResponse,
  type PersonalEquipmentPlanPreviewRequest,
  type PersonalEquipmentPlanPreviewResponse
} from '@phoenix/contracts'
import {
  planPersonalEquipmentUpgrade,
  type PersonalEquipmentCatalogue,
  type PersonalEquipmentCatalogueSnapshot,
  type PersonalEquipmentDefinition,
  type PersonalEquipmentModification
} from '@phoenix/elite'
import type { CommanderEquipmentReader } from '../domain/commander-equipment.js'
import type { PersonalEquipmentPlanner } from '../domain/personal-equipment-planner.js'
import type { PersonalMaterialInventoryReader } from '../domain/personal-materials.js'

type ObservedItem = CommanderSuit | CommanderWeapon

interface ResolvedObservedItem {
  definition: PersonalEquipmentDefinition
  item: ObservedItem
  installed: Array<{ id: string | null, symbol: string, name: string }>
}

export class PersonalEquipmentPlannerService implements PersonalEquipmentPlanner {
  public constructor (
    private readonly catalogue: PersonalEquipmentCatalogue,
    private readonly equipment: CommanderEquipmentReader,
    private readonly materials: PersonalMaterialInventoryReader
  ) {}

  public getOptions (): PersonalEquipmentPlannerOptionsResponse {
    const catalogue = this.catalogue.getSnapshot()
    const observed = this.resolvedObserved(catalogue)
    const engineers = new Map(catalogue.engineers.map(engineer => [engineer.id, engineer.displayName] as const))
    return PersonalEquipmentPlannerOptionsResponseSchema.parse({
      schemaVersion: 1,
      catalogueVersion: catalogue.catalogueVersion,
      generatedAt: catalogue.generatedAt,
      equipment: catalogue.equipmentDefinitions
        .filter(definition => definition.grades.some(grade => grade.modificationSlots > 0))
        .map(definition => ({
          id: definition.id,
          name: definition.displayName,
          kind: definition.kind,
          grades: definition.grades,
          observedInstances: observed.filter(candidate => candidate.definition.id === definition.id).map(candidate => ({
            instanceId: candidate.item.id,
            name: candidate.item.displayName,
            grade: candidate.item.grade,
            installedModifications: candidate.installed
          })),
          modifications: catalogue.modifications.filter(modification => (
            modification.compatibleEquipmentIds.includes(definition.id)
          )).map(modification => ({
            id: modification.id,
            name: modification.displayName,
            engineers: modification.engineerIds.map(id => required(engineers, id, 'engineer'))
          }))
        }))
        .sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name))
    })
  }

  public preview (request: PersonalEquipmentPlanPreviewRequest): PersonalEquipmentPlanPreviewResponse {
    const catalogue = this.catalogue.getSnapshot()
    const source = request.source.kind === 'observed'
      ? this.observedSource(catalogue, request.source.equipmentKind, request.source.instanceId)
      : {
          source: 'catalogue' as const,
          definition: required(
            new Map(catalogue.equipmentDefinitions.map(definition => [definition.id, definition] as const)),
            request.source.equipmentId,
            'equipment'
          ),
          currentGrade: request.source.currentGrade,
          installed: []
        }
    const plan = planPersonalEquipmentUpgrade(catalogue, {
      equipmentId: source.definition.id,
      currentGrade: source.currentGrade,
      targetGrade: request.targetGrade,
      installedModificationIds: source.installed.flatMap(modification => modification.id ? [modification.id] : []),
      installedModificationCount: source.installed.length,
      plannedModificationIds: request.plannedModificationIds
    })
    const resourceById = new Map(catalogue.microResources.map(resource => [resource.id, resource] as const))
    const engineerById = new Map(catalogue.engineers.map(engineer => [engineer.id, engineer.displayName] as const))
    const ownedById = new Map(this.materials.getInventory().groups.flatMap(group => (
      group.items.map(item => [item.id, item.observedTotal] as const)
    )))
    return PersonalEquipmentPlanPreviewResponseSchema.parse({
      schemaVersion: 1,
      catalogueVersion: plan.catalogueVersion,
      equipment: { ...plan.equipment, source: source.source },
      currentGrade: plan.currentGrade,
      targetGrade: plan.targetGrade,
      slots: plan.slots,
      steps: plan.steps.map(step => ({
        id: step.id,
        kind: step.kind,
        name: step.name,
        credits: step.credits,
        ingredients: step.ingredients.map(ingredient => ({
          materialId: ingredient.materialId,
          materialName: required(resourceById, ingredient.materialId, 'micro resource').displayName,
          count: ingredient.count
        }))
      })),
      materials: plan.materials.map(material => {
        const definition = required(resourceById, material.materialId, 'micro resource')
        const owned = ownedById.get(material.materialId) ?? 0
        return {
          materialId: material.materialId,
          materialName: definition.displayName,
          group: definition.playerGroup,
          required: material.count,
          owned,
          missing: Math.max(0, material.count - owned)
        }
      }),
      credits: plan.credits,
      specialists: plan.specialistIds.map(id => ({ id, name: required(engineerById, id, 'engineer') })),
      unresolvedInstalledModifications: source.installed.flatMap(modification => (
        modification.id === null ? [{ symbol: modification.symbol, name: modification.name }] : []
      ))
    })
  }

  private resolvedObserved (catalogue: PersonalEquipmentCatalogueSnapshot): ResolvedObservedItem[] {
    const equipment = this.equipment.getEquipment()
    return [
      ...this.resolveObservedItems(catalogue, 'suit', equipment.suits),
      ...this.resolveObservedItems(catalogue, 'weapon', equipment.weapons)
    ]
  }

  private resolveObservedItems (
    catalogue: PersonalEquipmentCatalogueSnapshot,
    kind: 'suit' | 'weapon',
    items: ObservedItem[]
  ): ResolvedObservedItem[] {
    return items.flatMap(item => {
      if (item.grade === null) return []
      const definition = catalogue.equipmentDefinitions.find(candidate => (
        candidate.kind === kind && candidate.frontierSymbols.some(symbol => sameSymbol(symbol, item.symbol))
      ))
      if (!definition) return []
      return [{ definition, item, installed: this.resolveInstalled(catalogue.modifications, definition.id, item.modifications) }]
    })
  }

  private resolveInstalled (
    modifications: PersonalEquipmentModification[],
    equipmentId: string,
    installed: CommanderEquipmentModification[]
  ): ResolvedObservedItem['installed'] {
    return installed.map(observed => {
      const matches = modifications.filter(candidate => (
        candidate.compatibleEquipmentIds.includes(equipmentId) &&
        candidate.journalSymbols.some(symbol => sameSymbol(symbol, observed.symbol))
      ))
      if (matches.length > 1) throw new Error(`Installed modification ${observed.symbol} is ambiguous for ${equipmentId}.`)
      return { id: matches[0]?.id ?? null, symbol: observed.symbol, name: observed.displayName }
    })
  }

  private observedSource (
    catalogue: PersonalEquipmentCatalogueSnapshot,
    kind: 'suit' | 'weapon',
    instanceId: number
  ): { source: 'observed', definition: PersonalEquipmentDefinition, currentGrade: number, installed: ResolvedObservedItem['installed'] } {
    const resolved = this.resolvedObserved(catalogue).find(candidate => (
      candidate.definition.kind === kind && candidate.item.id === instanceId
    ))
    if (!resolved || resolved.item.grade === null) throw new Error(`Observed ${kind} ${instanceId} is unavailable for planning.`)
    return { source: 'observed', definition: resolved.definition, currentGrade: resolved.item.grade, installed: resolved.installed }
  }
}

function sameSymbol (left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase()
}

function required<K, V> (values: Map<K, V>, key: K, label: string): V {
  const value = values.get(key)
  if (value === undefined) throw new Error(`Unknown ${label} ${String(key)}.`)
  return value
}
