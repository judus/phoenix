import type { NumpadExecutionResult, NumpadTreeSnapshot } from '@phoenix/contracts'

export interface NumpadCommands {
  getSnapshot(): NumpadTreeSnapshot
  execute(candidate: unknown, signal?: AbortSignal): Promise<NumpadExecutionResult>
}
