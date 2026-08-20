import { useMemo } from 'react'
import {
  ControlDeckNumpadTreeContributionSchema,
  type ControlDeckDeck,
  type ControlDeckNumpadContributionNode,
  type ControlDeckNumpadTreeContribution
} from '@jdu/control-deck-core'
import { ControlDeckApp } from '@jdu/control-deck-ui'
import type { NumpadTreeNode, NumpadTreeSnapshot } from '@phoenix/contracts'
import type { PhoenixApi } from '../../application/api/phoenix-api.js'
import type { ControlCategory } from '../../application/navigation/phoenix-route.js'
import { PhoenixControlDeckClient } from './phoenix-control-deck-client.js'

const NUMPAD_DESTINATION_PREFIX = 'phoenix-numpad:'

export function ControlsPage ({ api, category, numpadSnapshot, onNavigateCategory, onNavigateHref }: {
  api: PhoenixApi
  category: ControlCategory
  numpadSnapshot?: NumpadTreeSnapshot
  onNavigateCategory(category: ControlCategory): void
  onNavigateHref(href: string): void
}) {
  const client = useMemo(() => new PhoenixControlDeckClient(api), [api])
  const contributions = useMemo(() => numpadSnapshot ? phoenixNumpadContributions(numpadSnapshot) : [], [numpadSnapshot])

  const selectDeck = (deck: ControlDeckDeck) => {
    const selectedCategory = controlCategoryFromContext(deck.context)
    if (selectedCategory) onNavigateCategory(selectedCategory)
  }

  const navigate = async (destinationId: string) => {
    if (!destinationId.startsWith(NUMPAD_DESTINATION_PREFIX)) return
    const encoded = destinationId.slice(NUMPAD_DESTINATION_PREFIX.length)
    const separator = encoded.indexOf(':')
    const revision = Number(encoded.slice(0, separator))
    const address = encoded.slice(separator + 1)
    if (!Number.isInteger(revision) || separator < 1 || !/^\d+$/u.test(address)) {
      throw new Error('PHOENIX received an invalid Numpad destination.')
    }
    const result = await api.executeNumpadAddress(address, revision)
    if (result.status !== 'accepted') throw new Error(result.message)
    if (result.command?.navigationHref) onNavigateHref(result.command.navigationHref)
  }

  return <ControlDeckApp
    activeDeckContext={`phoenix:${category}`}
    api={client}
    numpadContributions={contributions}
    onActiveDeckChange={selectDeck}
    onNumpadNavigate={navigate}
  />
}

export function phoenixNumpadContributions (snapshot: NumpadTreeSnapshot): ControlDeckNumpadTreeContribution[] {
  const children = new Map<string | null, NumpadTreeNode[]>()
  for (const node of snapshot.nodes) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node])
  const roots = children.get(null) ?? []
  const shortcutsRoot = roots.find(node => node.id === 'desktop.shortcuts')
  const controlsRoot = roots.find(node => node.id === 'desktop.controls')
  const excludedFromNavigation = new Set([
    ...(shortcutsRoot ? descendants(shortcutsRoot.id, children) : []),
    ...(controlsRoot ? descendants(controlsRoot.id, children) : [])
  ].map(node => node.id))

  const navigationNodes = snapshot.nodes.filter(node => !excludedFromNavigation.has(node.id))
  const customNodes = shortcutsRoot ? descendants(shortcutsRoot.id, children).filter(node => node.id !== shortcutsRoot.id) : []

  return [
    contribution('phoenix-navigation', '2', 'PHOENIX', navigationNodes, null, snapshot.revision),
    contribution('phoenix-custom', '3', 'Custom', customNodes, shortcutsRoot?.id ?? null, snapshot.revision)
  ]
}

function contribution (
  id: string,
  selector: string,
  label: string,
  source: NumpadTreeNode[],
  replacedParentId: string | null,
  revision: number
): ControlDeckNumpadTreeContribution {
  const rootId = 'root'
  const nodes: ControlDeckNumpadContributionNode[] = [{ id: rootId, parentId: null, selector, label, available: true, action: null }]
  const sourceIds = new Set(source.map(node => node.id))
  for (const node of source) {
    nodes.push({
      id: node.id,
      parentId: node.parentId === replacedParentId || !node.parentId || !sourceIds.has(node.parentId) ? rootId : node.parentId,
      selector: node.selector,
      label: node.label,
      ...(node.description ? { description: node.description } : {}),
      available: node.available,
      ...(node.unavailableReason ? { unavailableReason: node.unavailableReason } : {}),
      action: node.target ? { type: 'navigation', destinationId: `${NUMPAD_DESTINATION_PREFIX}${revision}:${node.address}` } : null,
      ...(node.position ? { position: node.position } : {}),
      ...(node.span ? { columnSpan: node.span } : {}),
      ...(node.columns ? { columns: node.columns } : {}),
      ...(node.rows ? { rows: node.rows } : {})
    })
  }
  return ControlDeckNumpadTreeContributionSchema.parse({ id, nodes })
}

function descendants (rootId: string, children: Map<string | null, NumpadTreeNode[]>): NumpadTreeNode[] {
  const result: NumpadTreeNode[] = []
  const visit = (id: string) => {
    const node = [...children.values()].flat().find(candidate => candidate.id === id)
    if (node) result.push(node)
    for (const child of children.get(id) ?? []) visit(child.id)
  }
  visit(rootId)
  return result
}

function controlCategoryFromContext (context: string | null | undefined): ControlCategory | undefined {
  if (!context?.startsWith('phoenix:')) return undefined
  const category = context.slice('phoenix:'.length)
  return ['ship', 'combat', 'navigation', 'vessel', 'srv', 'on_foot', 'radio', 'emote', 'misc'].includes(category)
    ? category as ControlCategory
    : undefined
}
