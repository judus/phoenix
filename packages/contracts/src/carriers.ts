import { z } from 'zod'

const time = z.string().datetime({ offset: true })
const amount = z.number().finite().nonnegative()
export const CarrierLocationSchema = z.object({ system: z.string().min(1), systemAddress: z.number().int().nonnegative(), body: z.string().nullable(), observedAt: time }).strict()
export const CarrierFuelSchema = z.object({ tonnes: amount, currentRange: amount.nullable(), maximumRange: amount.nullable(), observedAt: time }).strict()
export const CarrierCapacitySchema = z.object({ total: amount, crew: amount, cargo: amount, reservedCargo: amount, shipPacks: amount, modulePacks: amount, free: amount, observedAt: time }).strict()
export const CarrierFinanceSchema = z.object({ balance: amount, reserves: amount.nullable(), available: amount.nullable(), reservePercent: amount.nullable(), observedAt: time }).strict()
export const CarrierAccessSchema = z.object({ docking: z.string(), notorious: z.boolean(), observedAt: time }).strict()
export const CarrierServicesSchema = z.object({ observedAt: time, changedAt: time.nullable(), items: z.array(z.object({ role: z.string(), name: z.string().nullable(), active: z.boolean(), enabled: z.boolean() }).strict()) }).strict()
export const CarrierJumpSchema = z.object({ system: z.string().min(1), body: z.string().nullable(), departureAt: time.nullable(), observedAt: time, status: z.enum(['scheduled', 'cancelled', 'arrival-observed']) }).strict()
export const CarrierSnapshotSchema = z.object({
  id: z.number().int().nonnegative(), callsign: z.string().nullable(), name: z.string().nullable(),
  type: z.string().nullable(), snapshotAt: time.nullable(), pendingDecommission: z.boolean().nullable(),
  location: CarrierLocationSchema.nullable(), fuel: CarrierFuelSchema.nullable(), capacity: CarrierCapacitySchema.nullable(),
  finance: CarrierFinanceSchema.nullable(), access: CarrierAccessSchema.nullable(), services: CarrierServicesSchema.nullable(), jump: CarrierJumpSchema.nullable()
}).strict()
export const CarrierHistorySchema = z.object({ id: z.string(), kind: z.string(), timestamp: time, description: z.string() }).strict()
export const FleetCarrierSchema = CarrierSnapshotSchema.extend({ history: z.array(CarrierHistorySchema) }).strict()
export type CarrierSnapshot = z.infer<typeof CarrierSnapshotSchema>
export type FleetCarrier = z.infer<typeof FleetCarrierSchema>
export type CarrierHistory = z.infer<typeof CarrierHistorySchema>
