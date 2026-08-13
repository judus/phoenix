import { z } from 'zod'
import { CommandDescriptorSchema, type CommandDescriptor } from './commands.js'

export const NumpadAddressSchema = z.string().regex(/^\d+$/u).max(32)

export const NumpadResolutionSchema = z.object({
  address: z.string().regex(/^\d*$/u).max(32),
  candidates: z.array(CommandDescriptorSchema).max(32),
  command: CommandDescriptorSchema.nullable(),
  hasLongerMatches: z.boolean(),
  status: z.enum(['incomplete', 'ambiguous', 'ready', 'unavailable', 'invalid'])
})

export const NumpadExecuteRequestSchema = z.object({ address: NumpadAddressSchema })

export type NumpadResolution = z.infer<typeof NumpadResolutionSchema>

export function resolveNumpadAddress (
  commands: readonly CommandDescriptor[],
  address: string
): NumpadResolution {
  const normalized = z.string().regex(/^\d*$/u).max(32).parse(address)
  const addressed = commands.filter(command => command.numericAddress !== undefined)
  const candidates = addressed
    .filter(command => command.numericAddress?.startsWith(normalized))
    .sort((left, right) => left.numericAddress!.localeCompare(right.numericAddress!))
    .slice(0, 32)
  const command = addressed.find(candidate => candidate.numericAddress === normalized) ?? null
  const hasLongerMatches = candidates.some(candidate => candidate.numericAddress !== normalized)
  const status: NumpadResolution['status'] = command
    ? hasLongerMatches ? 'ambiguous' : command.available ? 'ready' : 'unavailable'
    : candidates.length > 0 ? 'incomplete' : 'invalid'
  return NumpadResolutionSchema.parse({ address: normalized, candidates, command, hasLongerMatches, status })
}
