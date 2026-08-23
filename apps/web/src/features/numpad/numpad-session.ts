import {
  activateControlDeckNumpadSession,
  confirmControlDeckNumpadSelection,
  controlDeckNumpadChildren,
  displayedControlDeckNumpadAddress,
  enterControlDeckNumpadDigit,
  enterControlDeckNumpadDigitOrCancel,
  idleControlDeckNumpadSession,
  selectControlDeckNumpadNode,
  type ControlDeckNumpadSessionState,
  type ControlDeckNumpadSessionStatus,
  type ControlDeckNumpadTransition,
  type ControlDeckNumpadTree
} from 'control-deck/core'
import type { NumpadTreeNode, NumpadTreeSnapshot } from '@phoenix/contracts'

export type NumpadSessionStatus = ControlDeckNumpadSessionStatus | 'completed' | 'error' | 'stale'
export interface NumpadSessionState { active: boolean, pathIds: string[], pendingDigits: string, readyNodeId?: string, status: NumpadSessionStatus, message?: string }
export interface NumpadSessionTransition { state: NumpadSessionState, execute?: NumpadTreeNode }

export const idleNumpadSession = (): NumpadSessionState => idleControlDeckNumpadSession()
export const activateNumpadSession = (): NumpadSessionTransition => ({ state: activateControlDeckNumpadSession() })
export const cancelNumpadSession = (): NumpadSessionTransition => ({ state: idleNumpadSession() })

export function enterNumpadDigit (snapshot: NumpadTreeSnapshot, state: NumpadSessionState, digit: string, alwaysConfirm: boolean): NumpadSessionTransition {
  const tree = asControlDeckTree(snapshot, alwaysConfirm)
  return fromControlDeckTransition(snapshot, enterControlDeckNumpadDigit(tree, asControlDeckState(state), digit))
}

export function enterNumpadDigitOrCancel (snapshot: NumpadTreeSnapshot, state: NumpadSessionState, digit: string, alwaysConfirm: boolean): NumpadSessionTransition {
  const tree = asControlDeckTree(snapshot, alwaysConfirm)
  return fromControlDeckTransition(snapshot, enterControlDeckNumpadDigitOrCancel(tree, asControlDeckState(state), digit))
}

export function confirmNumpadSelection (snapshot: NumpadTreeSnapshot, state: NumpadSessionState): NumpadSessionTransition {
  const tree = asControlDeckTree(snapshot, false)
  return fromControlDeckTransition(snapshot, confirmControlDeckNumpadSelection(tree, asControlDeckState(state)))
}

export function selectNumpadNode (snapshot: NumpadTreeSnapshot, state: NumpadSessionState, nodeId: string, alwaysConfirm: boolean): NumpadSessionTransition {
  const tree = asControlDeckTree(snapshot, alwaysConfirm)
  return fromControlDeckTransition(snapshot, selectControlDeckNumpadNode(tree, asControlDeckState(state), nodeId))
}

export const executingNumpadSession = (state: NumpadSessionState): NumpadSessionState => ({ ...state, status: 'executing', message: 'Executing command…' })
export const finishNumpadSession = (_state: NumpadSessionState, status: 'completed' | 'error' | 'stale', message: string): NumpadSessionState => ({ ...idleNumpadSession(), status, message })
export const currentNumpadParent = (snapshot: NumpadTreeSnapshot, state: NumpadSessionState) => snapshot.nodes.find(node => node.id === state.pathIds.at(-1))
export const visibleNumpadNodes = (snapshot: NumpadTreeSnapshot, state: NumpadSessionState) => {
  const byId = new Map(snapshot.nodes.map(node => [node.id, node]))
  return controlDeckNumpadChildren(asControlDeckTree(snapshot, false), state.pathIds.at(-1) ?? null)
    .flatMap(node => byId.get(node.id) ?? [])
}
export const displayedNumpadAddress = (snapshot: NumpadTreeSnapshot, state: NumpadSessionState) => displayedControlDeckNumpadAddress(asControlDeckTree(snapshot, false), asControlDeckState(state))

function asControlDeckTree (snapshot: NumpadTreeSnapshot, alwaysConfirm: boolean): ControlDeckNumpadTree {
  return {
    activationDigit: '0',
    nodes: snapshot.nodes.map(node => ({
      id: node.id,
      parentId: node.parentId,
      selector: node.selector,
      address: node.address,
      label: node.label,
      ...(node.description ? { description: node.description } : {}),
      available: node.available,
      ...(node.unavailableReason ? { unavailableReason: node.unavailableReason } : {}),
      action: node.kind === 'menu' ? null : { type: 'navigation', destinationId: `phoenix-numpad:${node.id}` },
      confirm: node.kind === 'menu' ? false : alwaysConfirm,
      interactionHint: node.kind === 'menu' ? 'open' : 'tap',
      ...(node.position ? { position: node.position } : {}),
      ...(node.span ? { columnSpan: node.span } : {}),
      ...(node.position ? { rowSpan: 1 } : {}),
      ...(node.columns ? { columns: node.columns } : {}),
      ...(node.rows ? { rows: node.rows } : {})
    }))
  }
}

function asControlDeckState (state: NumpadSessionState): ControlDeckNumpadSessionState {
  if (!isControlDeckStatus(state.status)) return idleControlDeckNumpadSession()
  return {
    active: state.active,
    pathIds: state.pathIds,
    pendingDigits: state.pendingDigits,
    status: state.status,
    ...(state.readyNodeId ? { readyNodeId: state.readyNodeId } : {}),
    ...(state.message ? { message: state.message } : {})
  }
}

function fromControlDeckTransition (snapshot: NumpadTreeSnapshot, transition: ControlDeckNumpadTransition): NumpadSessionTransition {
  const execute = transition.action && transition.node
    ? snapshot.nodes.find(node => node.id === transition.node?.id)
    : undefined
  return { state: transition.state, ...(execute ? { execute } : {}) }
}

function isControlDeckStatus (status: NumpadSessionStatus): status is ControlDeckNumpadSessionStatus {
  return !['completed', 'error', 'stale'].includes(status)
}
