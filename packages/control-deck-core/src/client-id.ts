export interface ControlDeckCryptoSource {
  randomUUID(): string
}

export function createControlDeckClientId (
  cryptoSource: ControlDeckCryptoSource | null = globalThis.crypto ?? null,
  now: () => number = Date.now,
  random: () => number = Math.random
): string {
  if (typeof cryptoSource?.randomUUID === 'function') {
    try {
      return cryptoSource.randomUUID()
    } catch {}
  }
  return `local-${now().toString(36)}-${random().toString(36).slice(2)}`
}
