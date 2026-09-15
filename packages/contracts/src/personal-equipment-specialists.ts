import { z } from 'zod'
import { PersonalEquipmentCatalogueSourceSchema } from './personal-equipment-upgrades.js'

export const PersonalEquipmentSpecialistModificationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  targetKind: z.enum(['suit', 'weapon']),
  engineeringTechnology: z.enum(['kinetic', 'laser', 'plasma']).nullable()
}).strict()

export const PersonalEquipmentSpecialistSchema = z.object({
  id: z.string().min(1),
  frontierEngineerId: z.number().int().positive(),
  name: z.string().min(1),
  access: z.object({
    state: z.enum(['locked', 'known', 'invited', 'acquainted', 'unlocked', 'barred', 'unknown']),
    reportedStatus: z.string().min(1).nullable(),
    evidence: z.enum(['elite_journal', 'not_observed'])
  }).strict(),
  location: z.object({
    systemName: z.string().min(1),
    systemAddress: z.number().int().nonnegative().nullable(),
    marketId: z.number().int().nonnegative().nullable(),
    distanceLy: z.number().finite().nonnegative().nullable(),
    evidence: z.literal('external_catalogue')
  }).strict(),
  modifications: z.array(PersonalEquipmentSpecialistModificationSchema).min(1)
}).strict()

export const PersonalEquipmentSpecialistsResponseSchema = z.object({
  schemaVersion: z.literal(2),
  catalogueVersion: z.string().min(1),
  generatedAt: z.iso.datetime(),
  sources: z.array(PersonalEquipmentCatalogueSourceSchema).min(1),
  specialists: z.array(PersonalEquipmentSpecialistSchema)
}).strict()

export type PersonalEquipmentSpecialistModification = z.infer<typeof PersonalEquipmentSpecialistModificationSchema>
export type PersonalEquipmentSpecialist = z.infer<typeof PersonalEquipmentSpecialistSchema>
export type PersonalEquipmentSpecialistsResponse = z.infer<typeof PersonalEquipmentSpecialistsResponseSchema>
