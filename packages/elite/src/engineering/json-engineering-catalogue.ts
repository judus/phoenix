import { readFileSync } from 'node:fs'
import { z } from 'zod'

const EngineerRecordSchema = z.object({
  id: z.coerce.number().int().nonnegative(),
  name: z.string().min(1),
  description: z.string().min(1),
  systemName: z.string().min(1),
  systemAddress: z.coerce.number().int().nonnegative().nullable(),
  systemPosition: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]).nullable(),
  marketId: z.coerce.number().int().nonnegative().nullable()
})

const MaterialRecordSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['Raw', 'Manufactured', 'Encoded']),
  category: z.string().min(1),
  rarity: z.coerce.number().int().min(1).max(5)
}).loose()

const MaterialUseRecordSchema = z.object({
  symbol: z.string().min(1),
  blueprints: z.array(z.object({
    symbol: z.string().min(1),
    name: z.string().min(1),
    grades: z.array(z.coerce.number().int().positive())
  }))
}).loose()

const BlueprintFeatureSchema = z.object({
  value: z.array(z.number().finite()),
  improvement: z.boolean(),
  type: z.string().min(1).optional()
}).loose()

const BlueprintRecordSchema = z.object({
  id: z.number().int().nonnegative(),
  fdname: z.string().min(1),
  symbol: z.string().min(1),
  name: z.string().min(1),
  modulename: z.array(z.string().min(1)),
  engineers: z.record(z.string(), z.object({
    grades: z.array(z.coerce.number().int().positive())
  }).loose()),
  grades: z.record(z.string(), z.object({
    components: z.record(z.string(), z.coerce.number().int().positive()),
    features: z.record(z.string(), BlueprintFeatureSchema)
  }).loose())
}).loose()

export interface EngineeringCatalogueEngineer {
  id: number
  name: string
  description: string
  systemName: string
  systemAddress: number | null
  systemPosition: [number, number, number] | null
  marketId: number | null
}

export interface EngineeringCatalogueMaterial {
  symbol: string
  name: string
  type: 'Raw' | 'Manufactured' | 'Encoded'
  category: string
  rarity: number
  blueprintUses: Array<{ symbol: string, name: string, grades: number[] }>
}

export interface EngineeringCatalogueBlueprint {
  id: number
  fdname: string
  symbol: string
  name: string
  displayName: string
  moduleNames: string[]
  engineers: Record<string, { grades: number[] }>
  grades: Array<{
    grade: number
    components: Array<{ name: string, cost: number }>
    features: Array<{
      name: string
      values: number[]
      improvement: boolean
      type: string | null
    }>
  }>
}

export interface EngineeringCatalogue {
  getBlueprint(symbol: string): EngineeringCatalogueBlueprint | null
  listBlueprints(): EngineeringCatalogueBlueprint[]
  listEngineers(): EngineeringCatalogueEngineer[]
  listMaterials(): EngineeringCatalogueMaterial[]
}

export class JsonEngineeringCatalogue implements EngineeringCatalogue {
  private readonly blueprints: EngineeringCatalogueBlueprint[]
  private readonly engineers: EngineeringCatalogueEngineer[]
  private readonly materials: EngineeringCatalogueMaterial[]

  public constructor (paths: {
    blueprints: string
    engineers: string
    materials: string
    materialUses: string
  }) {
    this.engineers = z.array(EngineerRecordSchema).parse(readJson(paths.engineers))
    const uses = new Map(
      z.array(MaterialUseRecordSchema).parse(readJson(paths.materialUses))
        .map(item => [normalize(item.symbol), item.blueprints] as const)
    )
    this.materials = z.array(MaterialRecordSchema).parse(readJson(paths.materials)).map(material => ({
      symbol: material.symbol,
      name: material.name,
      type: material.type,
      category: material.category,
      rarity: material.rarity,
      blueprintUses: uses.get(normalize(material.symbol)) ?? []
    }))
    this.blueprints = z.array(BlueprintRecordSchema).parse(readJson(paths.blueprints)).map(blueprint => ({
      id: blueprint.id,
      fdname: blueprint.fdname,
      symbol: blueprint.symbol,
      name: blueprint.name,
      displayName: blueprintDisplayName(blueprint.symbol),
      moduleNames: blueprint.modulename,
      engineers: blueprint.engineers,
      grades: Object.entries(blueprint.grades)
        .map(([grade, value]) => ({
          grade: Number.parseInt(grade, 10),
          components: Object.entries(value.components).map(([name, cost]) => ({ name, cost })),
          features: Object.entries(value.features).map(([name, feature]) => ({
            name,
            values: feature.value,
            improvement: feature.improvement,
            type: feature.type ?? null
          }))
        }))
        .sort((left, right) => left.grade - right.grade)
    })).sort((left, right) => left.displayName.localeCompare(right.displayName))
  }

  public getBlueprint (symbol: string): EngineeringCatalogueBlueprint | null {
    const normalized = normalize(symbol)
    const blueprint = this.blueprints.find(candidate => (
      [candidate.symbol, candidate.fdname].some(value => normalize(value) === normalized)
    ))
    return blueprint ? structuredClone(blueprint) : null
  }

  public listBlueprints (): EngineeringCatalogueBlueprint[] {
    return structuredClone(this.blueprints)
  }

  public listEngineers (): EngineeringCatalogueEngineer[] {
    return structuredClone(this.engineers)
  }

  public listMaterials (): EngineeringCatalogueMaterial[] {
    return structuredClone(this.materials)
  }
}

function blueprintDisplayName (symbol: string): string {
  const [module = '', modification = ''] = symbol.split('_')
  return `${humanize(modification)} ${humanize(module)}`.replace(/\bMisc\b/u, 'Utility').trim()
}

function humanize (value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2').trim()
}

function normalize (value: string): string {
  return value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '')
}

function readJson (path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}
