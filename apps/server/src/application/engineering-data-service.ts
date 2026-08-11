import {
  EngineeringBlueprintDetailSchema,
  EngineeringBlueprintsResponseSchema,
  EngineeringEngineersResponseSchema,
  EngineeringMaterialsResponseSchema,
  type EngineeringBlueprintDetail,
  type EngineeringBlueprintsResponse,
  type EngineeringEngineer,
  type EngineeringEngineersResponse,
  type EngineeringMaterial,
  type EngineeringMaterialsResponse,
  type RuntimeState
} from '@phoenix/contracts'
import type {
  EngineeringCatalogue,
  EngineeringCatalogueBlueprint,
  EngineeringCatalogueMaterial
} from '@phoenix/elite'
import type { RuntimeStateReader } from '../domain/runtime-state.js'

const materialLimits = { 1: 300, 2: 250, 3: 200, 4: 150, 5: 100 } as const
const rarityNames = { 1: 'Very Common', 2: 'Common', 3: 'Standard', 4: 'Rare', 5: 'Very Rare' } as const

export interface EngineeringDataReader {
  getBlueprint(symbol: string): EngineeringBlueprintDetail | null
  getBlueprints(): EngineeringBlueprintsResponse
  getEngineers(): EngineeringEngineersResponse
  getMaterials(category?: EngineeringMaterial['category']): EngineeringMaterialsResponse
}

export class EngineeringDataService implements EngineeringDataReader {
  public constructor (
    private readonly catalogue: EngineeringCatalogue,
    private readonly runtimeState: RuntimeStateReader
  ) {}

  public getEngineers (): EngineeringEngineersResponse {
    const state = this.runtimeState.getCurrent()
    const engineers = this.catalogue.listEngineers().map(definition => {
      const progress = state.commander.engineers.find(candidate => (
        candidate.id === definition.id || sameName(candidate.name, definition.name)
      ))
      const status = progress?.status ?? null
      const stateName: EngineeringEngineer['state'] = status?.toLocaleLowerCase() === 'unlocked'
        ? 'unlocked'
        : progress
          ? 'known'
          : 'locked'
      return {
        id: definition.id,
        name: definition.name,
        description: definition.description,
        system: {
          name: definition.systemName,
          address: definition.systemAddress,
          position: definition.systemPosition
        },
        marketId: definition.marketId,
        progress: {
          status,
          rank: progress?.rank ?? 0,
          rankProgress: progress?.rankProgress ?? 0
        },
        state: stateName,
        distanceLy: distance(state.system.position, definition.systemPosition)
      }
    }).sort((left, right) => left.name.localeCompare(right.name))
    return EngineeringEngineersResponseSchema.parse({ engineers })
  }

  public getMaterials (category?: EngineeringMaterial['category']): EngineeringMaterialsResponse {
    const state = this.runtimeState.getCurrent()
    const materials = this.catalogue.listMaterials()
      .map(definition => this.materialView(definition, state))
      .filter(material => category === undefined || material.category === category)
      .sort((left, right) => left.group.localeCompare(right.group) || left.grade - right.grade || left.name.localeCompare(right.name))
    return EngineeringMaterialsResponseSchema.parse({
      updatedAt: state.inventory.materials?.updatedAt ?? null,
      materials
    })
  }

  public getBlueprints (): EngineeringBlueprintsResponse {
    const state = this.runtimeState.getCurrent()
    return EngineeringBlueprintsResponseSchema.parse({
      blueprints: this.catalogue.listBlueprints().map(blueprint => ({
        symbol: blueprint.symbol,
        name: blueprint.displayName,
        originalName: blueprint.name,
        moduleNames: blueprint.moduleNames,
        appliedModuleCount: appliedModules(blueprint, state).length
      }))
    })
  }

  public getBlueprint (symbol: string): EngineeringBlueprintDetail | null {
    const blueprint = this.catalogue.getBlueprint(symbol)
    if (!blueprint) return null
    const state = this.runtimeState.getCurrent()
    const engineers = this.getEngineers().engineers
    const materialDefinitions = this.catalogue.listMaterials()
    const materialViews = new Map(
      materialDefinitions.map(material => [normalize(material.name), this.materialView(material, state)])
    )
    const applied = appliedModules(blueprint, state)
    return EngineeringBlueprintDetailSchema.parse({
      symbol: blueprint.symbol,
      name: blueprint.displayName,
      originalName: blueprint.name,
      moduleNames: blueprint.moduleNames,
      appliedModuleCount: applied.length,
      appliedModules: applied.map(module => ({
        slotId: module.slotId,
        name: module.definition?.displayName ?? module.moduleId,
        grade: module.engineering?.level ?? null,
        experimentalEffect: module.engineering?.experimentalEffectLabel ?? module.engineering?.experimentalEffect ?? null
      })),
      engineers: Object.entries(blueprint.engineers).map(([name, capability]) => {
        const engineer = engineers.find(candidate => sameName(candidate.name, name))
        return {
          name,
          grades: capability.grades,
          systemName: engineer?.system.name ?? null,
          distanceLy: engineer?.distanceLy ?? null,
          status: engineer?.progress.status ?? null,
          rank: engineer?.progress.rank ?? 0
        }
      }),
      grades: blueprint.grades.map(grade => ({
        grade: grade.grade,
        components: grade.components.map(component => {
          const material = materialViews.get(normalize(component.name))
          return {
            id: material?.id ?? normalize(component.name),
            name: component.name,
            category: material?.category ?? null,
            grade: material?.grade ?? null,
            count: material?.count ?? 0,
            cost: component.cost
          }
        }),
        features: grade.features
      }))
    })
  }

  private materialView (definition: EngineeringCatalogueMaterial, state: RuntimeState): EngineeringMaterial {
    const category = definition.category === 'None'
      ? 'xeno' as const
      : definition.type.toLocaleLowerCase() as 'raw' | 'manufactured' | 'encoded'
    const inventory = category === 'xeno'
      ? [...(state.inventory.materials?.raw ?? []), ...(state.inventory.materials?.manufactured ?? []), ...(state.inventory.materials?.encoded ?? [])]
      : state.inventory.materials?.[category] ?? []
    const current = inventory.find(material => (
      sameName(material.id, definition.symbol) || sameName(material.label ?? '', definition.name)
    ))
    return {
      id: definition.symbol,
      name: definition.name,
      category,
      group: category === 'raw' ? `Category ${definition.category}` : category === 'xeno' ? definition.type : definition.category,
      grade: definition.rarity,
      rarity: rarityNames[definition.rarity as keyof typeof rarityNames],
      count: current?.count ?? 0,
      maxCount: materialLimits[definition.rarity as keyof typeof materialLimits],
      blueprintUses: definition.blueprintUses
    }
  }
}

function appliedModules (blueprint: EngineeringCatalogueBlueprint, state: RuntimeState) {
  const identifiers = [blueprint.symbol, blueprint.fdname].map(normalize)
  return state.ship.modules.filter(module => {
    const engineering = module.engineering
    return engineering !== null && (
      engineering.blueprintId === blueprint.id ||
      (engineering.blueprintName !== null && identifiers.includes(normalize(engineering.blueprintName)))
    )
  })
}

function distance (
  left: [number, number, number] | null,
  right: [number, number, number] | null
): number | null {
  return left && right ? Math.hypot(left[0] - right[0], left[1] - right[1], left[2] - right[2]) : null
}

function sameName (left: string, right: string): boolean {
  return normalize(left) === normalize(right)
}

function normalize (value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '')
}
