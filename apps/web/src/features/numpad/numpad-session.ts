import { numpadChildren, resolveNumpadLevel, type NumpadTreeNode, type NumpadTreeSnapshot } from '@phoenix/contracts'

export type NumpadSessionStatus = 'idle' | 'browsing' | 'incomplete' | 'ambiguous' | 'ready' | 'unavailable' | 'invalid' | 'executing' | 'completed' | 'error' | 'stale'
export interface NumpadSessionState { active: boolean, pathIds: string[], pendingDigits: string, readyNodeId?: string, status: NumpadSessionStatus, message?: string }
export interface NumpadSessionTransition { state: NumpadSessionState, execute?: NumpadTreeNode }

export const idleNumpadSession = (): NumpadSessionState => ({ active: false, pathIds: [], pendingDigits: '', status: 'idle' })
export const activateNumpadSession = (): NumpadSessionTransition => ({ state: { active: true, pathIds: [], pendingDigits: '', status: 'browsing' } })
export const cancelNumpadSession = (): NumpadSessionTransition => ({ state: idleNumpadSession() })

export function enterNumpadDigit(snapshot: NumpadTreeSnapshot, state: NumpadSessionState, digit: string, alwaysConfirm: boolean): NumpadSessionTransition {
  if (!/^\d$/u.test(digit)) return { state }
  const active = state.active ? state : activateNumpadSession().state
  if (active.pendingDigits.length >= 3) return { state: { ...active, status: 'invalid', message: 'No command matches this entry.' } }
  const digits = `${active.pendingDigits}${digit}`
  const resolution = resolveNumpadLevel(snapshot, active.pathIds.at(-1) ?? null, digits)
  if (resolution.status === 'ready' && resolution.exact) return chooseNode(snapshot, { ...active, pendingDigits: digits }, resolution.exact, alwaysConfirm, false)
  return { state: { ...active, pendingDigits: digits, readyNodeId: resolution.exact?.id, status: resolution.status, message: statusMessage(resolution.status) } }
}

export function confirmNumpadSelection(snapshot: NumpadTreeSnapshot, state: NumpadSessionState): NumpadSessionTransition {
  if (!state.active) return { state }
  const resolution = resolveNumpadLevel(snapshot, state.pathIds.at(-1) ?? null, state.pendingDigits)
  return resolution.exact ? chooseNode(snapshot, state, resolution.exact, false, true) : { state: { ...state, status: 'invalid', message: 'No exact command matches this entry.' } }
}

export function selectNumpadNode(snapshot: NumpadTreeSnapshot, state: NumpadSessionState, nodeId: string, alwaysConfirm: boolean): NumpadSessionTransition {
  const node = snapshot.nodes.find(candidate => candidate.id === nodeId)
  return node ? chooseNode(snapshot, state.active ? state : activateNumpadSession().state, node, alwaysConfirm, false) : { state: { ...state, status: 'invalid', message: 'Command node is unavailable.' } }
}

export const executingNumpadSession = (state: NumpadSessionState): NumpadSessionState => ({ ...state, status: 'executing', message: 'Executing command…' })
export const finishNumpadSession = (_state: NumpadSessionState, status: 'completed' | 'error' | 'stale', message: string): NumpadSessionState => ({ ...idleNumpadSession(), status, message })
export const currentNumpadParent = (snapshot: NumpadTreeSnapshot, state: NumpadSessionState) => snapshot.nodes.find(node => node.id === state.pathIds.at(-1))
export const visibleNumpadNodes = (snapshot: NumpadTreeSnapshot, state: NumpadSessionState) => numpadChildren(snapshot, state.pathIds.at(-1) ?? null)
export const displayedNumpadAddress = (snapshot: NumpadTreeSnapshot, state: NumpadSessionState) => `0${currentNumpadParent(snapshot, state)?.address ?? ''}${state.pendingDigits}`

function chooseNode(snapshot: NumpadTreeSnapshot, state: NumpadSessionState, node: NumpadTreeNode, alwaysConfirm: boolean, confirmed: boolean): NumpadSessionTransition {
  if (node.kind === 'menu') return { state: { active: true, pathIds: [...state.pathIds, node.id], pendingDigits: '', status: 'browsing' } }
  if (!node.available || !node.target) return { state: { ...state, pendingDigits: node.selector, readyNodeId: node.id, status: 'unavailable', message: node.unavailableReason ?? 'Command is unavailable.' } }
  if (alwaysConfirm && !confirmed) return { state: { ...state, pendingDigits: node.selector, readyNodeId: node.id, status: 'ready', message: 'Press Enter to execute.' } }
  return { execute: node, state: { ...state, pendingDigits: node.selector, readyNodeId: node.id, status: 'executing' } }
}

function statusMessage(status: NumpadSessionStatus): string | undefined {
  if (status === 'incomplete') return 'Enter another digit.'
  if (status === 'ambiguous') return 'Enter another digit or press Enter for the exact match.'
  if (status === 'invalid') return 'No command matches this entry.'
  if (status === 'unavailable') return 'Command is unavailable.'
  return undefined
}
