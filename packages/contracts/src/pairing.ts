import { z } from 'zod'

export const PairingStatusSchema = z.object({
  authenticated: z.boolean(),
  installationId: z.string().min(1),
  pairingRequired: z.boolean()
})

export type PairingStatus = z.infer<typeof PairingStatusSchema>
