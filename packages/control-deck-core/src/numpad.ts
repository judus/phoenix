import { z } from 'zod'
import { ControlDeckCommandTargetSchema } from './commands.js'
import type { ControlDeckConfiguration } from './decks.js'

export const ControlDeckNumpadSelectorSchema = z.string().regex(/^\d+$/u).max(3)

export const ControlDeckNumpadActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('command'), target: ControlDeckCommandTargetSchema }),
  z.object({ type: z.literal('navigation'), destinationId: z.string().min(1).max(200) })
])

export const ControlDeckNumpadContributionNodeSchema = z.object({
  id: z.string().min(1).max(100),
  parentId: z.string().min(1).max(100).nullable(),
  selector: ControlDeckNumpadSelectorSchema,
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  available: z.boolean().default(true),
  unavailableReason: z.string().min(1).max(500).optional(),
  action: ControlDeckNumpadActionSchema.nullable().default(null),
  confirm: z.boolean().optional(),
  position: z.number().int().positive().optional(),
  columnSpan: z.number().int().positive().max(24).optional(),
  rowSpan: z.number().int().positive().max(24).optional(),
  columns: z.number().int().min(1).max(24).optional(),
  rows: z.number().int().min(1).max(24).optional()
})

export const ControlDeckNumpadTreeContributionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9.-]{0,63}$/u),
  nodes: z.array(ControlDeckNumpadContributionNodeSchema).max(2048)
})

export const ControlDeckNumpadNodeSchema = ControlDeckNumpadContributionNodeSchema.extend({
  id: z.string().min(1),
  parentId: z.string().min(1).nullable(),
  address: z.string().regex(/^\d+$/u).max(32)
})

export const ControlDeckNumpadTreeSchema = z.object({
  activationDigit: z.literal('0'),
  nodes: z.array(ControlDeckNumpadNodeSchema).max(4096)
})

export type ControlDeckNumpadAction = z.infer<typeof ControlDeckNumpadActionSchema>
export type ControlDeckNumpadContributionNode = z.infer<typeof ControlDeckNumpadContributionNodeSchema>
export type ControlDeckNumpadTreeContribution = z.infer<typeof ControlDeckNumpadTreeContributionSchema>
export type ControlDeckNumpadNode = z.infer<typeof ControlDeckNumpadNodeSchema>
export type ControlDeckNumpadTree = z.infer<typeof ControlDeckNumpadTreeSchema>

export type ControlDeckNumpadSessionStatus = 'idle' | 'browsing' | 'incomplete' | 'ambiguous' | 'ready' | 'unavailable' | 'invalid' | 'executing'
export interface ControlDeckNumpadSessionState {
  active: boolean
  pathIds: string[]
  pendingDigits: string
  readyNodeId?: string
  status: ControlDeckNumpadSessionStatus
  message?: string
}
export interface ControlDeckNumpadTransition {
  action?: ControlDeckNumpadAction
  node?: ControlDeckNumpadNode
  state: ControlDeckNumpadSessionState
}

export function controlDeckNumpadContribution (configuration: ControlDeckConfiguration): ControlDeckNumpadTreeContribution {
  const nodes: ControlDeckNumpadContributionNode[] = []
  const groups = configuration.groups ?? configuration.decks.map(deck => ({ id: deck.id, name: deck.name, description: deck.description }))
  const populatedGroups = groups.map(group => ({
    group,
    decks: configuration.groups
      ? configuration.decks.filter(deck => deck.groupId === group.id)
      : configuration.decks.filter(deck => deck.id === group.id)
  })).filter(candidate => candidate.decks.length > 0)
  for (const [groupIndex, { group, decks }] of populatedGroups.entries()) {
    nodes.push({ id: `group.${group.id}`, parentId: null, selector: String(groupIndex + 1), label: group.name, description: group.description, available: true, action: null })
    for (const [deckIndex, deck] of decks.entries()) {
      const deckNodeId = `deck.${deck.id}`
      nodes.push({
        id: deckNodeId,
        parentId: `group.${group.id}`,
        selector: String(deckIndex + 1),
        label: deck.name,
        available: true,
        action: { type: 'navigation', destinationId: `control-deck:deck:${deck.id}` },
        columns: deck.layout.columns,
        rows: deck.layout.rows
      })
      for (const element of deck.elements) {
        if (element.kind !== 'command') continue
        const position = ((element.placement.row - 1) * deck.layout.columns) + element.placement.column
        nodes.push({
          id: `button.${deck.id}.${element.id}`,
          parentId: deckNodeId,
          selector: String(position),
          label: element.appearance.label || element.target.commandId,
          available: true,
          action: { type: 'command', target: element.target },
          position,
          columnSpan: element.placement.columnSpan,
          rowSpan: element.placement.rowSpan,
          confirm: element.interaction.confirmation.kind !== 'none'
        })
      }
    }
  }
  return ControlDeckNumpadTreeContributionSchema.parse({ id: 'control-deck', nodes })
}

export function aggregateControlDeckNumpadTrees (contributions: readonly ControlDeckNumpadTreeContribution[]): ControlDeckNumpadTree {
  const nodes: ControlDeckNumpadNode[] = []
  for (const candidate of contributions) {
    const contribution = ControlDeckNumpadTreeContributionSchema.parse(candidate)
    const localNodes = new Map(contribution.nodes.map(node => [node.id, node]))
    if (localNodes.size !== contribution.nodes.length) throw new Error(`Numpad contributor ${contribution.id} contains duplicate node IDs.`)
    const addressCache = new Map<string, string>()
    const visiting = new Set<string>()
    const addressFor = (node: ControlDeckNumpadContributionNode): string => {
      const cached = addressCache.get(node.id)
      if (cached) return cached
      if (visiting.has(node.id)) throw new Error(`Numpad contributor ${contribution.id} contains a parent cycle.`)
      visiting.add(node.id)
      const parentAddress = node.parentId === null
        ? ''
        : (() => {
            const parent = localNodes.get(node.parentId)
            if (!parent) throw new Error(`Numpad node ${node.id} references missing parent ${node.parentId}.`)
            return addressFor(parent)
          })()
      visiting.delete(node.id)
      const address = `${parentAddress}${node.selector}`
      addressCache.set(node.id, address)
      return address
    }
    for (const node of contribution.nodes) {
      nodes.push(ControlDeckNumpadNodeSchema.parse({
        ...node,
        id: `${contribution.id}:${node.id}`,
        parentId: node.parentId === null ? null : `${contribution.id}:${node.parentId}`,
        address: addressFor(node)
      }))
    }
  }
  const selectors = new Set<string>()
  for (const node of nodes) {
    const key = `${node.parentId ?? 'root'}:${node.selector}`
    if (selectors.has(key)) throw new Error(`Numpad selector collision at ${key}. Wrap contributions in distinct root nodes.`)
    selectors.add(key)
  }
  return ControlDeckNumpadTreeSchema.parse({ activationDigit: '0', nodes })
}

export function controlDeckNumpadChildren (tree: ControlDeckNumpadTree, parentId: string | null): ControlDeckNumpadNode[] {
  return tree.nodes.filter(node => node.parentId === parentId).sort((left, right) => Number(left.selector) - Number(right.selector))
}

export const idleControlDeckNumpadSession = (): ControlDeckNumpadSessionState => ({ active: false, pathIds: [], pendingDigits: '', status: 'idle' })
export const activateControlDeckNumpadSession = (): ControlDeckNumpadSessionState => ({ active: true, pathIds: [], pendingDigits: '', status: 'browsing' })

export function enterControlDeckNumpadDigit (tree: ControlDeckNumpadTree, state: ControlDeckNumpadSessionState, digit: string): ControlDeckNumpadTransition {
  if (!/^\d$/u.test(digit)) return { state }
  const active = state.active ? state : activateControlDeckNumpadSession()
  if (active.pendingDigits.length >= 3) return { state: { ...active, status: 'invalid', message: 'No button matches this entry.' } }
  const digits = `${active.pendingDigits}${digit}`
  const resolution = resolveLevel(tree, active.pathIds.at(-1) ?? null, digits)
  if (resolution.exact && !resolution.hasLongerMatches) return chooseControlDeckNumpadNode(tree, { ...active, pendingDigits: digits }, resolution.exact, false)
  return { state: { ...active, pendingDigits: digits, readyNodeId: resolution.exact?.id, status: resolution.status, message: resolutionMessage(resolution.status) } }
}

export function enterControlDeckNumpadDigitOrCancel (tree: ControlDeckNumpadTree, state: ControlDeckNumpadSessionState, digit: string): ControlDeckNumpadTransition {
  const transition = enterControlDeckNumpadDigit(tree, state, digit)
  return digit === '0' && transition.state.status === 'invalid' ? { state: idleControlDeckNumpadSession() } : transition
}

export function confirmControlDeckNumpadSelection (tree: ControlDeckNumpadTree, state: ControlDeckNumpadSessionState): ControlDeckNumpadTransition {
  if (!state.active) return { state }
  const resolution = resolveLevel(tree, state.pathIds.at(-1) ?? null, state.pendingDigits)
  return resolution.exact
    ? chooseControlDeckNumpadNode(tree, state, resolution.exact, true)
    : { state: { ...state, status: 'invalid', message: 'No exact button matches this entry.' } }
}

export function selectControlDeckNumpadNode (tree: ControlDeckNumpadTree, state: ControlDeckNumpadSessionState, nodeId: string): ControlDeckNumpadTransition {
  const node = tree.nodes.find(candidate => candidate.id === nodeId)
  const parentId = state.pathIds.at(-1) ?? null
  return node?.parentId === parentId
    ? chooseControlDeckNumpadNode(tree, state.active ? state : activateControlDeckNumpadSession(), node, false)
    : { state: { ...state, status: 'invalid', message: 'Numpad choice is unavailable.' } }
}

export function displayedControlDeckNumpadAddress (tree: ControlDeckNumpadTree, state: ControlDeckNumpadSessionState): string {
  const parent = tree.nodes.find(node => node.id === state.pathIds.at(-1))
  return `0${parent?.address ?? ''}${state.pendingDigits}`
}

function chooseControlDeckNumpadNode (tree: ControlDeckNumpadTree, state: ControlDeckNumpadSessionState, node: ControlDeckNumpadNode, confirmed: boolean): ControlDeckNumpadTransition {
  if (!node.available) return { node, state: { ...state, pendingDigits: node.selector, readyNodeId: node.id, status: 'unavailable', message: node.unavailableReason ?? 'This choice is unavailable.' } }
  const hasChildren = controlDeckNumpadChildren(tree, node.id).length > 0
  if (hasChildren) return {
    ...(node.action ? { action: node.action } : {}),
    node,
    state: { active: true, pathIds: [...state.pathIds, node.id], pendingDigits: '', status: 'browsing' }
  }
  if (!node.action) return { node, state: { ...state, status: 'unavailable', message: 'This branch contains no actions.' } }
  if (node.confirm && !confirmed) return { node, state: { ...state, pendingDigits: node.selector, readyNodeId: node.id, status: 'ready', message: 'Press Enter to execute.' } }
  return { action: node.action, node, state: { ...state, pendingDigits: node.selector, readyNodeId: node.id, status: 'executing' } }
}

function resolveLevel (tree: ControlDeckNumpadTree, parentId: string | null, digits: string) {
  const siblings = controlDeckNumpadChildren(tree, parentId)
  const candidates = siblings.filter(node => node.selector.startsWith(digits))
  const exact = siblings.find(node => node.selector === digits)
  const hasLongerMatches = candidates.some(node => node.selector !== digits)
  const status: ControlDeckNumpadSessionStatus = exact
    ? hasLongerMatches ? 'ambiguous' : exact.available ? 'ready' : 'unavailable'
    : candidates.length > 0 ? 'incomplete' : 'invalid'
  return { exact, hasLongerMatches, status }
}

function resolutionMessage (status: ControlDeckNumpadSessionStatus): string | undefined {
  if (status === 'incomplete') return 'Enter another digit.'
  if (status === 'ambiguous') return 'Enter another digit or press Enter.'
  if (status === 'invalid') return 'No button matches this entry.'
  if (status === 'unavailable') return 'This choice is unavailable.'
  return undefined
}
