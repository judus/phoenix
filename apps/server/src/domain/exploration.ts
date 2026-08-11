export interface BiologicalCompletionOverride {
  bodyKey: string
  completedAt: string
  signalKey: string
}

export interface BiologicalCompletionOverrideRepository {
  listBiologicalCompletionOverrides(): BiologicalCompletionOverride[]
  setBiologicalCompletionOverride(bodyKey: string, signalKey: string, completed: boolean): void
}
