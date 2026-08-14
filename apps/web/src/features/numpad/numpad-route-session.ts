const ACTIVATE_KEY = 'phoenix.numpad.activate'
const RETURN_ROUTE_KEY = 'phoenix.numpad.return-route'

export function armNumpadRoute (currentHash: string): void {
  try {
    window.sessionStorage.setItem(ACTIVATE_KEY, 'true')
    window.sessionStorage.setItem(RETURN_ROUTE_KEY, normalizeHash(currentHash))
  } catch {
    // The numpad still opens when session storage is unavailable; only return routing is lost.
  }
}

export function numpadRouteIsArmed (): boolean {
  try {
    return window.sessionStorage.getItem(ACTIVATE_KEY) === 'true'
  } catch {
    return false
  }
}

export function acknowledgeNumpadRouteActivation (): void {
  try {
    window.sessionStorage.removeItem(ACTIVATE_KEY)
  } catch {}
}

export function leaveNumpadRoute (): boolean {
  try {
    const destination = window.sessionStorage.getItem(RETURN_ROUTE_KEY)
    window.sessionStorage.removeItem(ACTIVATE_KEY)
    window.sessionStorage.removeItem(RETURN_ROUTE_KEY)
    if (!destination) return false
    window.location.hash = destination
    return true
  } catch {
    return false
  }
}

export function discardNumpadReturnRoute (): void {
  try {
    window.sessionStorage.removeItem(ACTIVATE_KEY)
    window.sessionStorage.removeItem(RETURN_ROUTE_KEY)
  } catch {}
}

function normalizeHash (hash: string): string {
  return hash.trim() === '' || hash === '#' ? '#/' : hash
}
