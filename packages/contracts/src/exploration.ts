import { z } from 'zod'

export const ExplorationOrganicSampleSchema = z.object({
  completed: z.boolean(),
  genus: z.string().min(1),
  lastUpdated: z.iso.datetime(),
  progress: z.number().int().min(0).max(3),
  scanTypes: z.array(z.string().min(1)),
  species: z.string().min(1),
  variant: z.string().min(1)
})

export const ExplorationBiologicalSignalSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1)
})

export const ExplorationManualCompletionSchema = z.object({
  completedAt: z.iso.datetime(),
  signalKey: z.string().min(1)
})

export const ExplorationBodyRecordSchema = z.object({
  key: z.string().min(1),
  systemName: z.string().min(1),
  systemAddress: z.number().int().nonnegative().nullable(),
  bodyId: z.number().int().nonnegative().nullable(),
  name: z.string().min(1),
  observedAt: z.iso.datetime(),
  discovered: z.boolean().nullable(),
  mapped: z.boolean().nullable(),
  footfalled: z.boolean().nullable(),
  surfaceScanCompleted: z.boolean(),
  scanned: z.boolean(),
  planetClass: z.string().min(1).nullable(),
  atmosphere: z.string().min(1).nullable(),
  volcanism: z.string().min(1).nullable(),
  signals: z.object({
    biological: z.number().int().nonnegative(),
    geological: z.number().int().nonnegative(),
    human: z.number().int().nonnegative()
  }),
  biologicalGenuses: z.array(z.string().min(1)),
  biologicalSignals: z.array(ExplorationBiologicalSignalSchema),
  manualBiologicalCompletions: z.array(ExplorationManualCompletionSchema),
  organicSamples: z.array(ExplorationOrganicSampleSchema)
})

export const ExplorationSystemRecordSchema = z.object({
  name: z.string().min(1),
  address: z.number().int().nonnegative().nullable(),
  allBodiesFound: z.boolean(),
  updatedAt: z.iso.datetime(),
  reportedBodyCount: z.number().int().nonnegative().nullable(),
  bodies: z.array(ExplorationBodyRecordSchema)
})

export const ExplorationLedgerResponseSchema = z.object({
  systems: z.array(ExplorationSystemRecordSchema),
  totals: z.object({
    systems: z.number().int().nonnegative(),
    bodies: z.number().int().nonnegative(),
    scannedBodies: z.number().int().nonnegative(),
    mappedBodies: z.number().int().nonnegative(),
    biologicalSignals: z.number().int().nonnegative(),
    geologicalSignals: z.number().int().nonnegative(),
    samplesCompleted: z.number().int().nonnegative()
  })
})

export const ExplorationManualCompletionRequestSchema = z.object({
  bodyKey: z.string().min(1),
  completed: z.boolean(),
  signalKey: z.string().min(1)
})

export const ExplorationManualCompletionResponseSchema = z.object({
  ok: z.literal(true)
})

export type ExplorationBiologicalSignal = z.infer<typeof ExplorationBiologicalSignalSchema>
export type ExplorationBodyRecord = z.infer<typeof ExplorationBodyRecordSchema>
export type ExplorationLedgerResponse = z.infer<typeof ExplorationLedgerResponseSchema>
export type ExplorationManualCompletionRequest = z.infer<typeof ExplorationManualCompletionRequestSchema>
export type ExplorationManualCompletionResponse = z.infer<typeof ExplorationManualCompletionResponseSchema>
export type ExplorationOrganicSample = z.infer<typeof ExplorationOrganicSampleSchema>
export type ExplorationSystemRecord = z.infer<typeof ExplorationSystemRecordSchema>
