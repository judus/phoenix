import { z } from 'zod'

export const CatalogueProvenanceSchema = z.object({
  kind: z.enum(['catalogue', 'inferred']),
  name: z.string().min(1),
  repository: z.string().url().nullable(),
  revision: z.string().min(1).nullable()
})

const EligibleModulesSchema = z.record(z.string(), z.number().finite())

export const ShipSlotDefinitionSchema = z.object({
  size: z.number().int().nonnegative(),
  name: z.string().min(1).nullable().optional(),
  eligible: EligibleModulesSchema.optional()
})

export const ShipDefinitionSchema = z.object({
  id: z.string().min(1),
  identifiers: z.object({
    coriolis: z.string().min(1),
    frontierEdId: z.number().int().nonnegative().nullable()
  }),
  displayName: z.string().min(1),
  manufacturer: z.string().min(1).nullable(),
  landingPadSize: z.enum(['small', 'medium', 'large']).nullable(),
  performance: z.object({
    baseArmour: z.number().finite().nonnegative().nullable(),
    baseShieldStrength: z.number().finite().nonnegative().nullable(),
    boost: z.number().finite().nonnegative().nullable(),
    hullMass: z.number().finite().nonnegative().nullable(),
    speed: z.number().finite().nonnegative().nullable()
  }),
  slots: z.object({
    core: z.array(ShipSlotDefinitionSchema.extend({ name: z.string().min(1) })),
    hardpoints: z.array(ShipSlotDefinitionSchema),
    optional: z.array(ShipSlotDefinitionSchema),
    utilities: z.array(ShipSlotDefinitionSchema)
  }),
  source: CatalogueProvenanceSchema
})

export const ModuleDefinitionSchema = z.object({
  journalId: z.string().min(1),
  displayName: z.string().min(1),
  category: z.string().min(1).nullable(),
  size: z.number().int().nonnegative().nullable(),
  rating: z.string().min(1).nullable(),
  mount: z.string().min(1).nullable(),
  guidance: z.string().min(1).nullable(),
  ship: z.string().min(1).nullable(),
  source: CatalogueProvenanceSchema
})

export const CatalogueInventoryDiagnosticsSchema = z.object({
  shipCount: z.number().int().nonnegative(),
  shipAliasCount: z.number().int().nonnegative(),
  moduleCount: z.number().int().nonnegative(),
  shipSource: z.string().min(1),
  moduleSource: z.string().min(1)
})

export const CatalogueDiagnosticsSchema = CatalogueInventoryDiagnosticsSchema.extend({
  currentShip: z.object({
    typeId: z.string().min(1).nullable(),
    displayName: z.string().min(1).nullable(),
    shipResolved: z.boolean(),
    moduleCount: z.number().int().nonnegative(),
    catalogueModules: z.number().int().nonnegative(),
    inferredModules: z.number().int().nonnegative()
  })
})

export type CatalogueDiagnostics = z.infer<typeof CatalogueDiagnosticsSchema>
export type CatalogueInventoryDiagnostics = z.infer<typeof CatalogueInventoryDiagnosticsSchema>
export type ModuleDefinition = z.infer<typeof ModuleDefinitionSchema>
export type ShipDefinition = z.infer<typeof ShipDefinitionSchema>
export type ShipSlotDefinition = z.infer<typeof ShipSlotDefinitionSchema>
