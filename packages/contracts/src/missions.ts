import { z } from 'zod'

export const MissionStatusSchema = z.enum(['active', 'completed', 'failed', 'abandoned', 'unknown'])

export const MissionProgressSchema = z.object({
  collected: z.number().int().nonnegative().nullable(),
  delivered: z.number().int().nonnegative().nullable(),
  required: z.number().int().nonnegative().nullable()
}).strict()

export const MissionProvenanceSchema = z.object({
  acceptanceObserved: z.boolean(),
  details: z.enum(['complete', 'partial']),
  snapshotObserved: z.boolean(),
  sources: z.array(z.enum(['historical-journal', 'live-journal', 'startup-snapshot'])),
  terminalObserved: z.boolean()
}).strict()

export const MissionRecordSchema = z.object({
  acceptedAt: z.string().datetime({ offset: true }).nullable(),
  abandonedAt: z.string().datetime({ offset: true }).nullable(),
  commodity: z.string().nullable(),
  commodityId: z.string().nullable(),
  commodityCount: z.number().int().nonnegative().nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  destinationSettlement: z.string().nullable(),
  destinationStation: z.string().nullable(),
  destinationSystem: z.string().nullable(),
  donated: z.number().int().nonnegative().nullable(),
  donation: z.number().int().nonnegative().nullable(),
  expiry: z.string().nullable(),
  faction: z.string().nullable(),
  failedAt: z.string().datetime({ offset: true }).nullable(),
  id: z.number().int().nonnegative(),
  influence: z.string().nullable(),
  killCount: z.number().int().nonnegative().nullable(),
  localizedName: z.string().nullable(),
  name: z.string().nullable(),
  passengerCount: z.number().int().nonnegative().nullable(),
  progress: MissionProgressSchema,
  provenance: MissionProvenanceSchema,
  redirectedAt: z.string().datetime({ offset: true }).nullable(),
  reputation: z.string().nullable(),
  reward: z.number().int().nonnegative().nullable(),
  receivedRewards: z.object({
    credits: z.number().int().nonnegative().nullable(),
    materials: z.array(z.object({
      id: z.string().min(1),
      label: z.string().nullable(),
      category: z.string().nullable(),
      count: z.number().int().nonnegative()
    }).strict()).nullable()
  }).strict().nullable(),
  status: MissionStatusSchema,
  statusUpdatedAt: z.string().datetime({ offset: true }),
  target: z.string().nullable(),
  targetFaction: z.string().nullable(),
  targetType: z.string().nullable(),
  targetTypeId: z.string().nullable(),
  updatedAt: z.string().datetime({ offset: true }),
  wing: z.boolean().nullable()
}).strict()

export const MissionBriefingSchema = z.object({
  onFoot: z.boolean(),
  activity: z.string().nullable(),
  conditions: z.array(z.string()),
  inventory: z.object({
    backpackAt: z.string().datetime({ offset: true }).nullable(),
    shipLockerAt: z.string().datetime({ offset: true }).nullable(),
    items: z.array(z.object({
      id: z.string().min(1),
      label: z.string().nullable(),
      count: z.number().int().nonnegative(),
      store: z.enum(['backpack', 'shipLocker']),
      observedAt: z.string().datetime({ offset: true })
    }).strict())
  }).strict()
}).strict()

export const MissionSchema = MissionRecordSchema.extend({ briefing: MissionBriefingSchema }).strict()

export const MissionSummarySchema = z.object({
  abandoned: z.number().int().nonnegative(),
  active: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  partial: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative()
}).strict()

export const MissionsResponseSchema = z.object({
  missions: z.array(MissionSchema),
  snapshotAt: z.string().datetime({ offset: true }).nullable(),
  summary: MissionSummarySchema
}).strict()

export type Mission = z.infer<typeof MissionSchema>
export type MissionRecord = z.infer<typeof MissionRecordSchema>
export type MissionBriefing = z.infer<typeof MissionBriefingSchema>
export type MissionStatus = z.infer<typeof MissionStatusSchema>
export type MissionsResponse = z.infer<typeof MissionsResponseSchema>
