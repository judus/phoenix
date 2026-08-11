let fallbackClientId: string | undefined

export function copilotClientId (): string {
  if (fallbackClientId) return fallbackClientId
  const storageKey = 'phoenix.copilot.client-id'
  try {
    const existing = globalThis.sessionStorage?.getItem(storageKey)
    if (existing) return (fallbackClientId = existing)
    const created = createCopilotId()
    globalThis.sessionStorage?.setItem(storageKey, created)
    return (fallbackClientId = created)
  } catch {
    return (fallbackClientId = createCopilotId())
  }
}

export function createCopilotId (
  cryptoSource: Pick<Crypto, 'randomUUID'> | null = globalThis.crypto ?? null
): string {
  if (typeof cryptoSource?.randomUUID === 'function') {
    try {
      return cryptoSource.randomUUID()
    } catch {}
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}
