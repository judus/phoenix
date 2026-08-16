export interface ClientIdentity {
  forScope(scope: 'copilot' | 'macros'): string
}

export function createClientId(
  cryptoSource: Pick<Crypto, 'randomUUID'> | null = globalThis.crypto ?? null
): string {
  if (typeof cryptoSource?.randomUUID === 'function') {
    try {
      return cryptoSource.randomUUID()
    } catch {}
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
