import { z } from 'zod'

export const PowerplayEntrySchema = z.object({
  id: z.string().min(1), timestamp: z.string().datetime(),
  kind: z.enum(['snapshot', 'join', 'leave', 'defect', 'merits', 'rank', 'collect', 'deliver']),
  power: z.string().min(1), fromPower: z.string().nullable(),
  rank: z.number().int().nonnegative().nullable(),
  merits: z.number().nonnegative().nullable(), gained: z.number().nullable(),
  timePledged: z.number().nonnegative().nullable(),
  item: z.string().nullable(), count: z.number().int().nonnegative().nullable()
}).strict().superRefine((entry, context) => {
  const required = entry.kind === 'snapshot' ? ['rank', 'merits', 'timePledged'] as const
    : entry.kind === 'merits' ? ['merits', 'gained'] as const
      : entry.kind === 'rank' ? ['rank'] as const
        : entry.kind === 'defect' ? ['fromPower'] as const
          : entry.kind === 'collect' || entry.kind === 'deliver' ? ['item', 'count'] as const : []
  for (const field of required) if (entry[field] === null) context.addIssue({ code: 'custom', path: [field], message: 'Required for this Powerplay observation.' })
  if (entry.timePledged !== null && entry.timePledged > Date.parse(entry.timestamp) / 1000) {
    context.addIssue({ code: 'custom', path: ['timePledged'], message: 'Pledge duration exceeds the observation date.' })
  }
})

export const PowerplayTargetSchema = z.object({
  power: z.string().trim().min(1).max(120), name: z.string().trim().min(1).max(120),
  rank: z.number().int().nonnegative().nullable(), merits: z.number().nonnegative().nullable()
}).strict().refine(value => value.rank !== null || value.merits !== null, {
  message: 'Enter a required rank or merit total from the in-game loyalty screen.'
})

export const PowerplayResponseSchema = z.object({
  pledge: z.object({
    power: z.string().nullable(), status: z.enum(['unknown', 'pledged', 'left']),
    rank: z.number().int().nonnegative().nullable(), merits: z.number().nonnegative().nullable(),
    pledgedAt: z.string().datetime().nullable(), updatedAt: z.string().datetime().nullable(),
    rankAt: z.string().datetime().nullable(), meritsAt: z.string().datetime().nullable()
  }).strict(),
  entries: z.array(PowerplayEntrySchema), retained: z.number().int().nonnegative(),
  target: PowerplayTargetSchema.nullable(),
  targetProgress: z.object({
    status: z.enum(['unknown', 'unpledged', 'different-power', 'tracking', 'requirements-met']),
    remainingMerits: z.number().nonnegative().nullable()
  }).strict().nullable()
}).strict()

export type PowerplayEntry = z.infer<typeof PowerplayEntrySchema>
export type PowerplayTarget = z.infer<typeof PowerplayTargetSchema>
export type PowerplayResponse = z.infer<typeof PowerplayResponseSchema>
