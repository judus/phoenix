import { z } from 'zod'

export const FleetShipStateSchema = z.enum([
  'active', 'stored-here', 'stored-remote', 'transfer', 'sold', 'unknown'
])

export const FleetShipSchema = z.object({
  displayName: z.string().nullable(),
  hot: z.boolean().nullable(),
  id: z.number().int().nonnegative(),
  identifier: z.string().nullable(),
  marketId: z.number().int().nonnegative().nullable(),
  name: z.string().nullable(),
  state: FleetShipStateSchema,
  station: z.string().nullable(),
  system: z.string().nullable(),
  transferPrice: z.number().int().nonnegative().nullable(),
  transferSeconds: z.number().int().nonnegative().nullable(),
  typeId: z.string().nullable(),
  updatedAt: z.string().datetime({ offset: true }),
  value: z.number().int().nonnegative().nullable()
}).strict()

export const StoredModuleSchema = z.object({
  buyPrice: z.number().int().nonnegative(),
  displayName: z.string().nullable(),
  engineering: z.object({
    blueprint: z.string(),
    level: z.number().int().nonnegative().nullable(),
    quality: z.number().nonnegative().nullable()
  }).strict().nullable(),
  hot: z.boolean(),
  marketId: z.number().int().nonnegative(),
  rawName: z.string(),
  storageSlot: z.number().int().nonnegative(),
  system: z.string(),
  transferCost: z.number().int().nonnegative(),
  transferSeconds: z.number().int().nonnegative(),
  updatedAt: z.string().datetime({ offset: true })
}).strict()

export const FleetResponseSchema = z.object({
  activeShipId: z.number().int().nonnegative().nullable(),
  carriers: z.object({
    observed: z.boolean(),
    items: z.array(z.never())
  }).strict(),
  ships: z.array(FleetShipSchema),
  shipsSnapshotAt: z.string().datetime({ offset: true }).nullable(),
  storedModules: z.object({
    details: z.enum(['complete', 'partial', 'unknown']),
    items: z.array(StoredModuleSchema),
    latestMutationAt: z.string().datetime({ offset: true }).nullable(),
    snapshotAt: z.string().datetime({ offset: true }).nullable()
  }).strict(),
  summary: z.object({
    active: z.number().int().nonnegative(),
    owned: z.number().int().nonnegative(),
    stored: z.number().int().nonnegative(),
    transferring: z.number().int().nonnegative(),
    unknown: z.number().int().nonnegative()
  }).strict()
}).strict()

export type FleetResponse = z.infer<typeof FleetResponseSchema>
export type FleetShip = z.infer<typeof FleetShipSchema>
export type StoredModule = z.infer<typeof StoredModuleSchema>
