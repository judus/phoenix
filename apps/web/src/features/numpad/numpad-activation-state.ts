type NumpadActivationListener = (enabled: boolean) => void

let enabled = false
const listeners = new Set<NumpadActivationListener>()

export function setNumpadActivationEnabled(next: boolean): void {
  enabled = next
  for (const listener of listeners) listener(enabled)
}

export function getNumpadActivationEnabled(): boolean {
  return enabled
}

export function subscribeToNumpadActivation(listener: NumpadActivationListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
