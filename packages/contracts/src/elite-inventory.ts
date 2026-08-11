import { z } from 'zod'

const snapshotTimestamp = z.iso.datetime()

export const CargoItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).nullable(),
  count: z.number().int().nonnegative(),
  stolen: z.number().int().nonnegative(),
  missionId: z.number().int().nonnegative().nullable()
})

export const CargoInventorySchema = z.object({
  updatedAt: snapshotTimestamp,
  vessel: z.enum(['ship', 'srv', 'unknown']),
  items: z.array(CargoItemSchema)
})

export const EngineeringMaterialCategorySchema = z.enum(['raw', 'manufactured', 'encoded'])

export const EngineeringMaterialSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).nullable(),
  count: z.number().int().nonnegative()
})

export const EngineeringMaterialsSchema = z.object({
  updatedAt: snapshotTimestamp,
  raw: z.array(EngineeringMaterialSchema),
  manufactured: z.array(EngineeringMaterialSchema),
  encoded: z.array(EngineeringMaterialSchema)
})

export const EngineeringMaterialAdjustmentSchema = z.object({
  updatedAt: snapshotTimestamp,
  category: EngineeringMaterialCategorySchema,
  id: z.string().min(1),
  label: z.string().min(1).nullable(),
  delta: z.number().int().refine(value => value !== 0, 'Material adjustment cannot be zero.')
})

export const EngineeringMaterialConsumptionSchema = z.object({
  updatedAt: snapshotTimestamp,
  id: z.string().min(1),
  label: z.string().min(1).nullable(),
  count: z.number().int().positive()
})

export const MicroResourceSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).nullable(),
  count: z.number().int().nonnegative(),
  ownerId: z.number().int().nonnegative().nullable(),
  missionId: z.number().int().nonnegative().nullable()
})

export const MicroResourceInventorySchema = z.object({
  updatedAt: snapshotTimestamp,
  items: z.array(MicroResourceSchema),
  components: z.array(MicroResourceSchema),
  consumables: z.array(MicroResourceSchema),
  data: z.array(MicroResourceSchema)
})

export const CommanderInventorySchema = z.object({
  cargo: CargoInventorySchema.nullable(),
  materials: EngineeringMaterialsSchema.nullable(),
  shipLocker: MicroResourceInventorySchema.nullable(),
  backpack: MicroResourceInventorySchema.nullable()
})

export const EliteInventoryFileSnapshotSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cargo'), payload: CargoInventorySchema }),
  z.object({ kind: z.literal('ship_locker'), payload: MicroResourceInventorySchema }),
  z.object({ kind: z.literal('backpack'), payload: MicroResourceInventorySchema })
])

export type CargoInventory = z.infer<typeof CargoInventorySchema>
export type CommanderInventory = z.infer<typeof CommanderInventorySchema>
export type EliteInventoryFileSnapshot = z.infer<typeof EliteInventoryFileSnapshotSchema>
export type EngineeringMaterialAdjustment = z.infer<typeof EngineeringMaterialAdjustmentSchema>
export type EngineeringMaterialConsumption = z.infer<typeof EngineeringMaterialConsumptionSchema>
export type EngineeringMaterials = z.infer<typeof EngineeringMaterialsSchema>
export type MicroResourceInventory = z.infer<typeof MicroResourceInventorySchema>
