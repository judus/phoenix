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

export const MissionSchema = z.object({
  acceptedAt: z.string().datetime({ offset: true }).nullable(),
  abandonedAt: z.string().datetime({ offset: true }).nullable(),
  commodity: z.string().nullable(),
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
  status: MissionStatusSchema,
  statusUpdatedAt: z.string().datetime({ offset: true }),
  target: z.string().nullable(),
  targetFaction: z.string().nullable(),
  targetType: z.string().nullable(),
  updatedAt: z.string().datetime({ offset: true }),
  wing: z.boolean().nullable()
}).strict()

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
  summary: MissionSummarySchema
}).strict()

export type Mission = z.infer<typeof MissionSchema>
export type MissionStatus = z.infer<typeof MissionStatusSchema>
export type MissionsResponse = z.infer<typeof MissionsResponseSchema>
