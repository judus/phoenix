import {
  numpadChildren,
  resolveNumpadLevel,
  type NumpadTreeNode,
  type NumpadTreeSnapshot
} from '@phoenix/contracts'

export type NumpadSessionStatus =
  | 'idle'
  | 'browsing'
  | 'incomplete'
  | 'ambiguous'
  | 'ready'
  | 'unavailable'
  | 'invalid'
  | 'executing'
  | 'completed'
  | 'error'
  | 'stale'

export interface NumpadSessionState {
  active: boolean
  pathIds: string[]
  pendingDigits: string
  readyNodeId?: string
  status: NumpadSessionStatus
  message?: string
}

export interface NumpadSessionTransition {
  state: NumpadSessionState
  execute?: NumpadTreeNode
}

export const idleNumpadSession = (): NumpadSessionState => ({
  active: false,
  pathIds: [],
  pendingDigits: '',
  status: 'idle'
})

export function activateNumpadSession (): NumpadSessionTransition {
  return { state: { active: true, pathIds: [], pendingDigits: '', status: 'browsing' } }
}

export function cancelNumpadSession (): NumpadSessionTransition {
  return { state: idleNumpadSession() }
}

export function enterNumpadDigit (
  snapshot: NumpadTreeSnapshot,
  state: NumpadSessionState,
  digit: string,
  alwaysConfirm: boolean
): NumpadSessionTransition {
  if (!/^\d$/u.test(digit)) return { state }
  const active = state.active ? state : activateNumpadSession().state
  const digits = `${active.pendingDigits}${digit}`
  const parentId = active.pathIds.at(-1) ?? null
  const resolution = resolveNumpadLevel(snapshot, parentId, digits)
  if (resolution.status === 'ready' && resolution.exact) {
    return chooseNode(snapshot, { ...active, pendingDigits: digits }, resolution.exact, alwaysConfirm, false)
  }
  return {
    state: {
      ...active,
      pendingDigits: digits,
      readyNodeId: resolution.exact?.id,
      status: resolution.status,
      message: statusMessage(resolution.status)
    }
  }
}

export function confirmNumpadSelection (
  snapshot: NumpadTreeSnapshot,
  state: NumpadSessionState
): NumpadSessionTransition {
  if (!state.active) return { state }
  const parentId = state.pathIds.at(-1) ?? null
  const resolution = resolveNumpadLevel(snapshot, parentId, state.pendingDigits)
  if (!resolution.exact) {
    return { state: { ...state, status: 'invalid', message: 'No exact command matches this entry.' } }
  }
  return chooseNode(snapshot, state, resolution.exact, false, true)
}

export function selectNumpadNode (
  snapshot: NumpadTreeSnapshot,
  state: NumpadSessionState,
  nodeId: string,
  alwaysConfirm: boolean
): NumpadSessionTransition {
  const node = snapshot.nodes.find(candidate => candidate.id === nodeId)
  if (!node) return { state: { ...state, status: 'invalid', message: 'Command node is unavailable.' } }
  const active = state.active ? state : activateNumpadSession().state
  return chooseNode(snapshot, active, node, alwaysConfirm, false)
}

export function executingNumpadSession (state: NumpadSessionState): NumpadSessionState {
  return { ...state, status: 'executing', message: 'Executing command…' }
}

export function finishNumpadSession (
  state: NumpadSessionState,
  status: 'completed' | 'error' | 'stale',
  message: string
): NumpadSessionState {
  return { ...state, status, message }
}

export function currentNumpadParent (
  snapshot: NumpadTreeSnapshot,
  state: NumpadSessionState
): NumpadTreeNode | undefined {
  return snapshot.nodes.find(node => node.id === state.pathIds.at(-1))
}

export function visibleNumpadNodes (
  snapshot: NumpadTreeSnapshot,
  state: NumpadSessionState
): NumpadTreeNode[] {
  return numpadChildren(snapshot, state.pathIds.at(-1) ?? null)
}

export function displayedNumpadAddress (
  snapshot: NumpadTreeSnapshot,
  state: NumpadSessionState
): string {
  const parent = currentNumpadParent(snapshot, state)
  return `0${parent?.address ?? ''}${state.pendingDigits}`
}

function chooseNode (
  snapshot: NumpadTreeSnapshot,
  state: NumpadSessionState,
  node: NumpadTreeNode,
  alwaysConfirm: boolean,
  confirmed: boolean
): NumpadSessionTransition {
  const children = numpadChildren(snapshot, node.id)
  if (children.length > 0) {
    return {
      state: {
        active: true,
        pathIds: [...state.pathIds, node.id],
        pendingDigits: '',
        status: 'browsing'
      }
    }
  }
  if (!node.available || !node.target) {
    return {
      state: {
        ...state,
        pendingDigits: node.selector,
        readyNodeId: node.id,
        status: 'unavailable',
        message: node.unavailableReason ?? 'Command is unavailable.'
      }
    }
  }
  if (alwaysConfirm && !confirmed) {
    return {
      state: {
        ...state,
        pendingDigits: node.selector,
        readyNodeId: node.id,
        status: 'ready',
        message: 'Press Enter to execute.'
      }
    }
  }
  return {
    execute: node,
    state: {
      ...state,
      pendingDigits: node.selector,
      readyNodeId: node.id,
      status: 'executing'
    }
  }
}

function statusMessage (status: NumpadSessionStatus): string | undefined {
  if (status === 'incomplete') return 'Enter another digit.'
  if (status === 'ambiguous') return 'Enter another digit or press Enter for the exact match.'
  if (status === 'invalid') return 'No command matches this entry.'
  if (status === 'unavailable') return 'Command is unavailable.'
  return undefined
}
