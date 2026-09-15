import { z } from 'zod'

export const PersonalMaterialGroupIdSchema = z.enum(['goods', 'assets', 'data', 'consumables'])

export const PersonalMaterialInventoryItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  group: PersonalMaterialGroupIdSchema,
  shipLocker: z.number().int().nonnegative().nullable(),
  backpack: z.number().int().nonnegative().nullable(),
  observedTotal: z.number().int().nonnegative(),
  missionTagged: z.number().int().nonnegative()
}).strict()

export const PersonalMaterialInventoryGroupSchema = z.object({
  id: PersonalMaterialGroupIdSchema,
  label: z.string().min(1),
  items: z.array(PersonalMaterialInventoryItemSchema)
}).strict()

export const PersonalMaterialInventoryResponseSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.iso.datetime().nullable(),
  stores: z.object({
    shipLockerUpdatedAt: z.iso.datetime().nullable(),
    backpackUpdatedAt: z.iso.datetime().nullable()
  }).strict(),
  groups: z.array(PersonalMaterialInventoryGroupSchema)
}).strict()

export type PersonalMaterialGroupId = z.infer<typeof PersonalMaterialGroupIdSchema>
export type PersonalMaterialInventoryItem = z.infer<typeof PersonalMaterialInventoryItemSchema>
export type PersonalMaterialInventoryGroup = z.infer<typeof PersonalMaterialInventoryGroupSchema>
export type PersonalMaterialInventoryResponse = z.infer<typeof PersonalMaterialInventoryResponseSchema>
