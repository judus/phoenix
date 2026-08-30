import type { RuntimeState } from '@phoenix/contracts'

export function readRuntimeTelemetryFlag (state: RuntimeState, key: string): boolean | undefined {
  const status = state.gameStatus
  if (!status) return undefined
  const flags: Record<string, unknown> = { ...status.flags, ...status.flags2 }
  return typeof flags[key] === 'boolean' ? flags[key] : undefined
}
