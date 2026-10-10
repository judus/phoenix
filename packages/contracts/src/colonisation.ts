import { z } from 'zod'

export const ColonisationResourceSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), required: z.number().int().nonnegative(),
  provided: z.number().int().nonnegative(), payment: z.number().nonnegative().nullable()
}).strict()

export const ColonisationDepotSchema = z.object({
  marketId: z.number().int().nonnegative(), system: z.string().nullable(), station: z.string().nullable(),
  updatedAt: z.iso.datetime(), progress: z.number().min(0).max(1), complete: z.boolean(), failed: z.boolean(),
  resources: z.array(ColonisationResourceSchema)
}).strict()

export const ColonisationClaimSchema = z.object({
  systemAddress: z.number().int().nonnegative(), system: z.string().min(1),
  status: z.enum(['claimed', 'released']), updatedAt: z.iso.datetime()
}).strict()

export const ColonisationContributionSchema = z.object({
  id: z.string().min(1), marketId: z.number().int().nonnegative(), timestamp: z.iso.datetime(),
  system: z.string().nullable(), station: z.string().nullable(),
  items: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), amount: z.number().int().nonnegative() }).strict())
}).strict()

export const ColonisationResponseSchema = z.object({
  depots: z.array(ColonisationDepotSchema), claims: z.array(ColonisationClaimSchema),
  contributions: z.array(ColonisationContributionSchema), retainedContributions: z.number().int().nonnegative()
}).strict()

export type ColonisationDepot = z.infer<typeof ColonisationDepotSchema>
export type ColonisationClaim = z.infer<typeof ColonisationClaimSchema>
export type ColonisationContribution = z.infer<typeof ColonisationContributionSchema>
export type ColonisationResponse = z.infer<typeof ColonisationResponseSchema>
