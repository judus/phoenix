import { z } from 'zod'
import { CarrierSnapshotSchema, CarrierHistorySchema, type FleetCarrier } from '@phoenix/contracts'

export const CarrierObservationSchema = CarrierHistorySchema.extend({
  carrierId: z.number().int().nonnegative(),
  patch: CarrierSnapshotSchema.omit({ id: true }).partial(),
  managementEvidence: z.boolean()
}).strict()
export type CarrierObservation = z.infer<typeof CarrierObservationSchema>

export interface CarrierRepository {
  put(observation: CarrierObservation): void
  observations(): CarrierObservation[]
  history(carrierId: number): CarrierObservation[]
}
export interface CarrierReader { getCarriers(): FleetCarrier[] }
