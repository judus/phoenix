let fallbackClientId: string | undefined

export function copilotClientId (): string {
  if (fallbackClientId) return fallbackClientId
  const storageKey = 'phoenix.copilot.client-id'
  try {
    const existing = globalThis.sessionStorage?.getItem(storageKey)
    if (existing) return (fallbackClientId = existing)
    const created = crypto.randomUUID()
    globalThis.sessionStorage?.setItem(storageKey, created)
    return (fallbackClientId = created)
  } catch {
    return (fallbackClientId = crypto.randomUUID())
  }
}
