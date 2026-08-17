const ACTIVATE_KEY = 'phoenix.numpad.activate'
const RETURN_ROUTE_KEY = 'phoenix.numpad.return-route'

export function armNumpadRoute(currentHash: string): void {
  try { window.sessionStorage.setItem(ACTIVATE_KEY, 'true'); window.sessionStorage.setItem(RETURN_ROUTE_KEY, currentHash.trim() === '' || currentHash === '#' ? '#/' : currentHash) } catch {}
}
export function numpadRouteIsArmed(): boolean { try { return window.sessionStorage.getItem(ACTIVATE_KEY) === 'true' } catch { return false } }
export function acknowledgeNumpadRouteActivation(): void { try { window.sessionStorage.removeItem(ACTIVATE_KEY) } catch {} }
export function discardNumpadReturnRoute(): void { try { window.sessionStorage.removeItem(ACTIVATE_KEY); window.sessionStorage.removeItem(RETURN_ROUTE_KEY) } catch {} }
export function leaveNumpadRoute(): boolean {
  try {
    const destination = window.sessionStorage.getItem(RETURN_ROUTE_KEY)
    discardNumpadReturnRoute()
    if (!destination) return false
    window.location.hash = destination
    return true
  } catch { return false }
}
