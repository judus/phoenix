import { z } from 'zod'
import { CommandRiskSchema } from './commands.js'

export const CopilotCapabilityIdSchema = z.string().min(1).max(240)

export const CopilotPermissionPolicySchema = z.object({
  version: z.literal(2),
  enabledCapabilityIds: z.array(CopilotCapabilityIdSchema).max(1024)
}).superRefine((policy, context) => {
  if (new Set(policy.enabledCapabilityIds).size !== policy.enabledCapabilityIds.length) {
    context.addIssue({ code: 'custom', message: 'Copilot capability permissions must be unique.' })
  }
})

export const CopilotCapabilitySchema = z.object({
  id: CopilotCapabilityIdSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  kind: z.enum(['fixed-tool', 'game-action', 'macro']),
  access: z.enum(['read', 'display', 'external', 'control']),
  available: z.boolean(),
  enabled: z.boolean(),
  loadCost: z.number().int().positive(),
  risk: CommandRiskSchema.nullable()
})

export const CopilotCapabilitySubgroupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  capabilities: z.array(CopilotCapabilitySchema)
})

export const CopilotCapabilityGroupSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  capabilities: z.array(CopilotCapabilitySchema),
  subgroups: z.array(CopilotCapabilitySubgroupSchema).default([])
})

export const CopilotLoadSchema = z.object({
  score: z.number().int().nonnegative(),
  percentage: z.number().int().min(0).max(100),
  level: z.enum(['focused', 'broad', 'overloaded']),
  enabled: z.object({
    fixedTools: z.number().int().nonnegative(),
    gameActions: z.number().int().nonnegative(),
    macros: z.number().int().nonnegative(),
    total: z.number().int().nonnegative()
  })
})

export const CopilotCapabilityCatalogueSchema = z.object({
  groups: z.array(CopilotCapabilityGroupSchema),
  load: CopilotLoadSchema
})

export const CopilotProfileCapabilitySettingsSchema = z.object({
  profileId: z.string().regex(/^[a-z][a-z0-9_-]*$/u),
  permissions: CopilotPermissionPolicySchema,
  installationPermissions: CopilotPermissionPolicySchema,
  capabilities: CopilotCapabilityCatalogueSchema
}).strict()

const InjectedToolPayloadSchema = z.record(z.string(), z.unknown())

export const CopilotInjectedToolSchema = z.object({
  id: CopilotCapabilityIdSchema,
  mcp: InjectedToolPayloadSchema,
  realtime: InjectedToolPayloadSchema
})

export const CopilotToolDiagnosticsResponseSchema = z.object({
  version: z.literal(1),
  tools: z.array(CopilotInjectedToolSchema)
})

export type CopilotPermissionPolicy = z.infer<typeof CopilotPermissionPolicySchema>
export type CopilotCapability = z.infer<typeof CopilotCapabilitySchema>
export type CopilotCapabilitySubgroup = z.infer<typeof CopilotCapabilitySubgroupSchema>
export type CopilotCapabilityGroup = z.infer<typeof CopilotCapabilityGroupSchema>
export type CopilotCapabilityCatalogue = z.infer<typeof CopilotCapabilityCatalogueSchema>
export type CopilotProfileCapabilitySettings = z.infer<typeof CopilotProfileCapabilitySettingsSchema>
export type CopilotLoad = z.infer<typeof CopilotLoadSchema>
export type CopilotInjectedTool = z.infer<typeof CopilotInjectedToolSchema>
export type CopilotToolDiagnosticsResponse = z.infer<typeof CopilotToolDiagnosticsResponseSchema>
