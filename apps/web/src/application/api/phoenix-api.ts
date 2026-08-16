import type { HealthResponse, PairingStatus, RuntimeState } from '@phoenix/contracts'

export interface PhoenixApi {
  claimPairing(code: string, signal?: AbortSignal): Promise<PairingStatus>
  getHealth(signal?: AbortSignal): Promise<HealthResponse>
  getPairingStatus(signal?: AbortSignal): Promise<PairingStatus>
  getRuntimeState(signal?: AbortSignal): Promise<RuntimeState>
  eventStreamUrl(): string
}
