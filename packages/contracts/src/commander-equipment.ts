import { z } from 'zod'

const EquipmentTimestampSchema = z.iso.datetime()
const EquipmentIdSchema = z.number().int().nonnegative()
const EquipmentGradeSchema = z.number().int().min(1).max(5)

export const CommanderEquipmentModificationSchema = z.object({
  symbol: z.string().min(1),
  displayName: z.string().min(1)
}).strict()

export const CommanderEquipmentUpgradeResourceSchema = z.object({
  symbol: z.string().min(1),
  displayName: z.string().min(1),
  count: z.number().int().positive()
}).strict()

const CommanderEquipmentUpgradeSchema = z.object({
  grade: EquipmentGradeSchema,
  credits: z.number().int().nonnegative(),
  resources: z.array(CommanderEquipmentUpgradeResourceSchema),
  updatedAt: EquipmentTimestampSchema
}).strict()

export const CommanderSuitSchema = z.object({
  id: EquipmentIdSchema,
  symbol: z.string().min(1),
  displayName: z.string().min(1),
  grade: EquipmentGradeSchema.nullable(),
  modifications: z.array(CommanderEquipmentModificationSchema),
  purchasePrice: z.number().int().nonnegative().nullable(),
  purchasedAt: EquipmentTimestampSchema.nullable(),
  lastUpgrade: CommanderEquipmentUpgradeSchema.nullable(),
  loadoutIds: z.array(EquipmentIdSchema),
  updatedAt: EquipmentTimestampSchema
}).strict()

export const CommanderWeaponSchema = z.object({
  id: EquipmentIdSchema,
  symbol: z.string().min(1),
  displayName: z.string().min(1),
  manufacturer: z.string().min(1).nullable(),
  category: z.string().min(1).nullable(),
  damageType: z.string().min(1).nullable(),
  grade: EquipmentGradeSchema.nullable(),
  modifications: z.array(CommanderEquipmentModificationSchema),
  purchasePrice: z.number().int().nonnegative().nullable(),
  purchasedAt: EquipmentTimestampSchema.nullable(),
  lastUpgrade: CommanderEquipmentUpgradeSchema.nullable(),
  loadoutIds: z.array(EquipmentIdSchema),
  updatedAt: EquipmentTimestampSchema
}).strict()

export const CommanderSuitLoadoutSlotSchema = z.object({
  slot: z.string().min(1),
  weaponId: EquipmentIdSchema
}).strict()

export const CommanderSuitLoadoutSchema = z.object({
  id: EquipmentIdSchema,
  name: z.string().min(1),
  suitId: EquipmentIdSchema,
  slots: z.array(CommanderSuitLoadoutSlotSchema),
  updatedAt: EquipmentTimestampSchema
}).strict()

export const CommanderEquipmentResponseSchema = z.object({
  schemaVersion: z.literal(1),
  ownershipCoverage: z.literal('observed'),
  currentLoadoutId: EquipmentIdSchema.nullable(),
  updatedAt: EquipmentTimestampSchema.nullable(),
  loadouts: z.array(CommanderSuitLoadoutSchema),
  suits: z.array(CommanderSuitSchema),
  weapons: z.array(CommanderWeaponSchema),
  summary: z.object({
    loadouts: z.number().int().nonnegative(),
    suits: z.number().int().nonnegative(),
    weapons: z.number().int().nonnegative()
  }).strict()
}).strict()

export type CommanderEquipmentModification = z.infer<typeof CommanderEquipmentModificationSchema>
export type CommanderEquipmentResponse = z.infer<typeof CommanderEquipmentResponseSchema>
export type CommanderEquipmentUpgradeResource = z.infer<typeof CommanderEquipmentUpgradeResourceSchema>
export type CommanderSuit = z.infer<typeof CommanderSuitSchema>
export type CommanderSuitLoadout = z.infer<typeof CommanderSuitLoadoutSchema>
export type CommanderSuitLoadoutSlot = z.infer<typeof CommanderSuitLoadoutSlotSchema>
export type CommanderWeapon = z.infer<typeof CommanderWeaponSchema>
