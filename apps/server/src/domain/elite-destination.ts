import type { EliteDestinationPhase, PlotEliteDestinationResult } from '@phoenix/contracts'

export const ELITE_DESTINATION_BINDINGS = [
  'GalaxyMapOpen',
  'UI_Up',
  'UI_Select',
  'UI_Right',
  'CamZoomIn'
] as const

export type EliteDestinationBinding = typeof ELITE_DESTINATION_BINDINGS[number]

export interface EliteDestinationInputStatus {
  available: boolean
  detail: string
  missingBindings: EliteDestinationBinding[]
}

export interface EliteDestinationInput {
  getStatus(): EliteDestinationInputStatus
  hold(binding: EliteDestinationBinding, durationMs: number, signal?: AbortSignal): Promise<void>
  tap(binding: EliteDestinationBinding, signal?: AbortSignal): Promise<void>
  tapKey(key: string, signal?: AbortSignal): Promise<void>
  typeText(text: string, signal?: AbortSignal): Promise<void>
}

export interface EliteDestinations {
  plot(systemName: string, signal?: AbortSignal): Promise<PlotEliteDestinationResult>
}

export class EliteDestinationOperationError extends Error {
  public constructor (
    public readonly phase: EliteDestinationPhase,
    message: string,
    public readonly timedOut = false,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'EliteDestinationOperationError'
  }
}
