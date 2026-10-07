import { z } from 'zod'

export const CommunityGoalSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  systemName: z.string().min(1),
  stationName: z.string().min(1),
  activityType: z.string().min(1),
  objective: z.string().min(1),
  targetCommodities: z.string(),
  contributed: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  target: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  // Frontier supplies a wall-clock time, without a timezone. Do not infer an instant from it.
  expiry: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/u),
  briefing: z.string()
}).strict()

export const CommunityGoalsSnapshotSchema = z.object({
  goals: z.array(CommunityGoalSchema),
  fetchedAt: z.string().datetime({ offset: true })
}).strict()

export const CommunityGoalsResponseSchema = CommunityGoalsSnapshotSchema.extend({
  cache: z.enum(['fresh', 'refreshed', 'stale'])
}).strict()

export type CommunityGoal = z.infer<typeof CommunityGoalSchema>
export type CommunityGoalsSnapshot = z.infer<typeof CommunityGoalsSnapshotSchema>
export type CommunityGoalsResponse = z.infer<typeof CommunityGoalsResponseSchema>
