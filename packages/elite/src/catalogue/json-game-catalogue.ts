import { readFileSync } from 'node:fs'
import { z } from 'zod'
import {
  ModuleDefinitionSchema,
  ShipDefinitionSchema,
  type CatalogueInventoryDiagnostics,
  type ModuleDefinition,
  type ShipDefinition
} from '@phoenix/contracts'

const CatalogueSourceSchema = z.object({
  name: z.string().min(1),
  repository: z.string().url(),
  commit: z.string().min(1).optional(),
  revision: z.string().min(1).nullable().optional()
}).loose()

const ShipCatalogueSchema = z.object({
  schemaVersion: z.literal(1),
  source: CatalogueSourceSchema,
  aliases: z.record(z.string(), z.string().min(1)),
  ships: z.array(ShipDefinitionSchema.omit({ source: true }))
})

const ModuleCatalogueSchema = z.object({
  schemaVersion: z.literal(1),
  source: CatalogueSourceSchema,
  modules: z.array(ModuleDefinitionSchema.omit({ source: true }))
})

export interface GameCatalogue {
  listShips(): ShipDefinition[]
  resolveShip(identifier: string): ShipDefinition | null
  resolveModule(journalId: string): ModuleDefinition
  getDiagnostics(): CatalogueInventoryDiagnostics
}

export class JsonGameCatalogue implements GameCatalogue {
  private readonly aliases: Map<string, string>
  private readonly ships: Map<string, ShipDefinition>
  private readonly modules: Map<string, ModuleDefinition>
  private readonly diagnostics: CatalogueInventoryDiagnostics

  public constructor (shipCataloguePath: string, moduleCataloguePath: string) {
    const shipCatalogue = ShipCatalogueSchema.parse(readJson(shipCataloguePath))
    const moduleCatalogue = ModuleCatalogueSchema.parse(readJson(moduleCataloguePath))
    const shipSource = provenance(shipCatalogue.source)
    const moduleSource = provenance(moduleCatalogue.source)
    this.aliases = new Map(
      Object.entries(shipCatalogue.aliases).map(([alias, id]) => [normalizeIdentifier(alias), id])
    )
    this.ships = new Map(shipCatalogue.ships.map(ship => [ship.id, {
      ...ship,
      source: shipSource
    }]))
    this.modules = new Map(moduleCatalogue.modules.map(module => [normalizeModuleId(module.journalId), {
      ...module,
      source: moduleSource
    }]))
    this.diagnostics = {
      shipCount: this.ships.size,
      shipAliasCount: this.aliases.size,
      moduleCount: this.modules.size,
      shipSource: shipSource.name,
      moduleSource: moduleSource.name
    }
  }

  public resolveShip (identifier: string): ShipDefinition | null {
    const normalized = normalizeIdentifier(identifier)
    const id = this.aliases.get(normalized) ?? normalized
    return this.ships.get(id) ?? null
  }

  public listShips (): ShipDefinition[] {
    return structuredClone([...this.ships.values()].sort((left, right) => (
      left.displayName.localeCompare(right.displayName)
    )))
  }

  public resolveModule (journalId: string): ModuleDefinition {
    return this.modules.get(normalizeModuleId(journalId)) ?? inferModule(journalId)
  }

  public getDiagnostics (): CatalogueInventoryDiagnostics {
    return structuredClone(this.diagnostics)
  }
}

function provenance (source: z.infer<typeof CatalogueSourceSchema>) {
  return {
    kind: 'catalogue' as const,
    name: source.name,
    repository: source.repository,
    revision: source.commit ?? source.revision ?? null
  }
}

function inferModule (journalId: string): ModuleDefinition {
  const normalized = normalizeModuleId(journalId)
  const size = regexInteger(normalized, /_size(\d+)/i) ?? namedModuleSize(normalized)
  const moduleClass = regexInteger(normalized, /_class(\d+)/i)
  return ModuleDefinitionSchema.parse({
    journalId,
    displayName: inferredModuleName(normalized),
    category: inferredCategory(normalized),
    size,
    rating: moduleClass ? ({ 1: 'E', 2: 'D', 3: 'C', 4: 'B', 5: 'A' } as const)[moduleClass as 1 | 2 | 3 | 4 | 5] ?? null : null,
    mount: inferredMount(normalized),
    guidance: null,
    ship: null,
    source: {
      kind: 'inferred',
      name: 'PHOENIX journal identifier inference',
      repository: null,
      revision: null
    }
  })
}

function inferredModuleName (identifier: string): string {
  const knownPatterns: Array<[string, string]> = [
    ['_armour_grade1', 'Lightweight Alloy'],
    ['_armour_grade2', 'Reinforced Alloy'],
    ['_armour_grade3', 'Military Grade Composite'],
    ['_armour_mirrored', 'Mirrored Surface Composite'],
    ['_armour_reactive', 'Reactive Surface Composite'],
    ['hyperdrive_overcharge', 'Frame Shift Drive (SCO)'],
    ['multidronecontrol_miningv2', 'Mining Multi Limpet Controller'],
    ['fighterbaymk2', 'Fighter Hangar'],
    ['miningtoolv2', 'Mining Tool V2'],
    ['dockingcomputer_advanced', 'Advanced Docking Computer'],
    ['planetapproachsuite_advanced', 'Planetary Approach Suite'],
    ['detailedsurfacescanner', 'Detailed Surface Scanner']
  ]
  const known = knownPatterns.find(([pattern]) => identifier.includes(pattern))
  if (known) return known[1]

  const humanized = identifier
    .replace(/^(?:hpt|int|modular)_/, '')
    .replace(/_(?:size\d+|class\d+|fixed|turret|gimbal)(?=_|$)/g, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
    .trim()
  return humanized || journalIdFallback(identifier)
}

function inferredCategory (identifier: string): string | null {
  if (identifier.startsWith('hpt_')) return 'hardpoint'
  if (identifier.startsWith('int_')) return 'internal'
  if (identifier.includes('_armour_')) return 'standard'
  return null
}

function inferredMount (identifier: string): string | null {
  if (identifier.includes('_fixed_')) return 'Fixed'
  if (identifier.includes('_gimbal_')) return 'Gimballed'
  if (identifier.includes('_turret_')) return 'Turreted'
  return null
}

function namedModuleSize (identifier: string): number | null {
  const named = identifier.match(/_(small|medium|large|huge)(?:_|$)/i)?.[1]?.toLowerCase()
  return named ? ({ small: 1, medium: 2, large: 3, huge: 4 } as const)[named as 'small' | 'medium' | 'large' | 'huge'] : null
}

function regexInteger (value: string, pattern: RegExp): number | null {
  const match = value.match(pattern)?.[1]
  if (!match) return null
  const parsed = Number.parseInt(match, 10)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function normalizeIdentifier (value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

function normalizeModuleId (value: string): string {
  return value.trim().toLowerCase()
}

function journalIdFallback (identifier: string): string {
  return identifier.length > 0 ? identifier : 'Unknown module'
}

function readJson (path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}
